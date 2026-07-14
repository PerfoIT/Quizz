import type { Answer, Participant, Question, SessionStatus } from "@prisma/client";
import { prisma } from "../db.js";
import type {
  LeaderboardEntry,
  PublicParticipant,
  PublicQuestion,
  PublicQuiz,
  RevealedQuestion,
  SessionSnapshot,
  SessionWithQuiz
} from "../types.js";

const SESSION_CODE_LENGTH = 4;

export function getPublicUrl() {
  return process.env.PUBLIC_URL ?? "http://localhost:3000";
}

export function sanitizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 60);
}

export function calculatePoints(isCorrect: boolean, responseTimeMs: number, timeLimitSeconds: number) {
  if (!isCorrect) return 0;
  const timeLimitMs = timeLimitSeconds * 1000;
  if (responseTimeMs > timeLimitMs) return 0;
  if (responseTimeMs <= 6000) return 1000;
  const penaltySteps = Math.ceil((responseTimeMs - 6000) / 1000);
  return Math.max(0, 1000 - penaltySteps * 100);
}

export async function listQuizzes(): Promise<PublicQuiz[]> {
  const quizzes = await prisma.quiz.findMany({
    include: { _count: { select: { questions: true } } },
    orderBy: { createdAt: "desc" }
  });

  return quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    questionCount: quiz._count.questions
  }));
}

export async function createSession(quizId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new Error("Quiz introuvable.");

  let code = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    code = Array.from({ length: SESSION_CODE_LENGTH }, () =>
      Math.floor(Math.random() * 36).toString(36).toUpperCase()
    ).join("");

    const existing = await prisma.session.findUnique({ where: { code } });
    if (!existing) break;
  }

  await prisma.session.create({ data: { code, quizId } });
  return getSessionSnapshot(code);
}

export async function getSessionSnapshot(code: string): Promise<SessionSnapshot> {
  const session = await getSessionWithQuiz(code);
  const currentQuestion = getCurrentQuestion(session);
  const responseCount = currentQuestion
    ? await prisma.response.count({
        where: { questionId: currentQuestion.id, participant: { sessionId: session.id } }
      })
    : 0;

  return {
    code: session.code,
    status: session.status,
    currentQuestionIndex: session.currentQuestionIndex,
    questionStartedAt: session.questionStartedAt?.toISOString() ?? null,
    joinUrl: `${getPublicUrl().replace(/\/$/, "")}/join/${session.code}`,
    quiz: {
      id: session.quiz.id,
      title: session.quiz.title,
      description: session.quiz.description,
      questionCount: session.quiz.questions.length
    },
    participants: session.participants
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
      .map(toPublicParticipant),
    currentQuestion: currentQuestion ? toPublicQuestion(currentQuestion) : null,
    responseCount,
    leaderboard: getLeaderboard(session.participants)
  };
}

export async function joinSession(code: string, name: string, socketId: string) {
  const cleanName = sanitizeName(name);
  if (!cleanName) throw new Error("Le nom est requis.");

  const session = await prisma.session.findUnique({ where: { code } });
  if (!session) throw new Error("Session introuvable.");
  if (session.status === "FINISHED") throw new Error("Cette session est terminee.");

  const participant = await prisma.participant.create({
    data: { name: cleanName, socketId, sessionId: session.id }
  });

  return participant;
}

export async function reconnectParticipant(participantId: string, socketId: string) {
  return prisma.participant.update({
    where: { id: participantId },
    data: { socketId }
  });
}

export async function updateParticipantSocket(socketId: string, nextSocketId: string | null) {
  await prisma.participant.updateMany({
    where: { socketId },
    data: { socketId: nextSocketId }
  });
}

export async function setSessionStatus(code: string, status: SessionStatus) {
  await prisma.session.update({ where: { code }, data: { status } });
  return getSessionSnapshot(code);
}

export async function startQuestion(code: string) {
  const session = await getSessionWithQuiz(code);
  const question = getCurrentQuestion(session);
  if (!question) throw new Error("Aucune question disponible.");

  await prisma.session.update({
    where: { code },
    data: { status: "QUESTION", questionStartedAt: new Date() }
  });

  return getSessionSnapshot(code);
}

export async function nextQuestion(code: string) {
  const session = await getSessionWithQuiz(code);
  const nextIndex = session.currentQuestionIndex + 1;
  const finished = nextIndex >= session.quiz.questions.length;

  await prisma.session.update({
    where: { code },
    data: {
      currentQuestionIndex: finished ? session.currentQuestionIndex : nextIndex,
      questionStartedAt: finished ? session.questionStartedAt : null,
      status: finished ? "FINISHED" : "LEADERBOARD"
    }
  });

  return getSessionSnapshot(code);
}

export async function submitAnswer(participantId: string, answerOrder: number) {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: {
      session: {
        include: {
          quiz: {
            include: {
              questions: {
                include: { answers: true },
                orderBy: { order: "asc" }
              }
            }
          }
        }
      }
    }
  });

  if (!participant) throw new Error("Participant introuvable.");
  if (participant.session.status !== "QUESTION") throw new Error("Aucune question active.");

  const question = participant.session.quiz.questions[participant.session.currentQuestionIndex];
  if (!question || !participant.session.questionStartedAt) throw new Error("Question introuvable.");

  const answer = question.answers.find((item) => item.order === answerOrder);
  if (!answer) throw new Error("Reponse introuvable.");

  const responseTimeMs = Date.now() - participant.session.questionStartedAt.getTime();
  const points = calculatePoints(answer.isCorrect, responseTimeMs, question.timeLimitSeconds);

  const response = await prisma.response.create({
    data: {
      participantId,
      questionId: question.id,
      answerId: answer.id,
      isCorrect: answer.isCorrect && points > 0,
      responseTimeMs,
      points
    }
  });

  if (points > 0) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { score: { increment: points } }
    });
  }

  return response;
}

export async function getRevealedQuestion(code: string): Promise<RevealedQuestion> {
  const session = await getSessionWithQuiz(code);
  const question = getCurrentQuestion(session);
  if (!question) throw new Error("Question introuvable.");
  const correctAnswer = question.answers.find((answer) => answer.isCorrect);
  if (!correctAnswer) throw new Error("Bonne reponse introuvable.");

  return {
    ...toPublicQuestion(question),
    explanation: question.explanation,
    correctAnswerOrder: correctAnswer.order
  };
}

async function getSessionWithQuiz(code: string): Promise<SessionWithQuiz> {
  const session = await prisma.session.findUnique({
    where: { code },
    include: {
      participants: true,
      quiz: {
        include: {
          questions: {
            include: { answers: { orderBy: { order: "asc" } } },
            orderBy: { order: "asc" }
          }
        }
      }
    }
  });

  if (!session) throw new Error("Session introuvable.");
  return session;
}

function getCurrentQuestion(session: SessionWithQuiz) {
  return session.quiz.questions[session.currentQuestionIndex] ?? null;
}

function toPublicQuestion(question: Question & { answers: Answer[] }): PublicQuestion {
  return {
    type: question.type,
    order: question.order,
    text: question.text,
    imageUrl: question.imageUrl,
    timeLimitSeconds: question.timeLimitSeconds,
    answers: question.answers
      .sort((a, b) => a.order - b.order)
      .map((answer) => ({ order: answer.order, text: answer.text, imageUrl: answer.imageUrl }))
  };
}

function toPublicParticipant(participant: Participant): PublicParticipant {
  return {
    name: participant.name,
    score: participant.score,
    joinedAt: participant.joinedAt.toISOString()
  };
}

function getLeaderboard(participants: Participant[]): LeaderboardEntry[] {
  return [...participants]
    .sort((a, b) => b.score - a.score || a.joinedAt.getTime() - b.joinedAt.getTime())
    .map((participant, index) => ({
      name: participant.name,
      score: participant.score,
      rank: index + 1
    }));
}
