import type { Answer, Participant, Question, Session, SessionStatus } from "@prisma/client";

export type PublicQuiz = {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  paceMode: "AUTO" | "MANUAL";
};

export type PublicParticipant = {
  name: string;
  score: number;
  joinedAt: string;
};

export type PublicAnswer = {
  order: number;
  text: string;
  imageUrl: string | null;
};

export type PublicQuestion = {
  sourceBankQuestionId: string | null;
  type: "QCM" | "IMAGE" | "OTHER";
  order: number;
  text: string;
  imageUrl: string | null;
  timeLimitSeconds: number;
  scoringGraceSeconds: number;
  answers: PublicAnswer[];
};

export type RevealedQuestion = PublicQuestion & {
  explanation: string;
  correctAnswerOrder: number;
};

export type LeaderboardEntry = {
  name: string;
  score: number;
  rank: number;
};

export type SessionSnapshot = {
  code: string;
  name: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  joinUrl: string;
  quiz: PublicQuiz;
  participants: PublicParticipant[];
  currentQuestion: PublicQuestion | null;
  responseCount: number;
  leaderboard: LeaderboardEntry[];
};

export type SessionWithQuiz = Session & {
  quiz: {
    id: string;
    title: string;
    description: string | null;
    questions: Array<Question & { answers: Answer[] }>;
  };
  participants: Participant[];
};
