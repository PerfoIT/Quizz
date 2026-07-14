import { Router } from "express";
import { z } from "zod";
import {
  hashPassword,
  requireAdminRole,
  requireAuth,
  type AuthenticatedRequest
} from "../auth.js";
import { prisma } from "../db.js";

export const adminRouter = Router();

const visibilitySchema = z.enum(["PRIVATE", "ORGANIZATION"]).default("PRIVATE");

const answerSchema = z.object({
  text: z.string().trim().min(1).max(300),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  isCorrect: z.boolean()
});

const bankQuestionSchema = z.object({
  type: z.enum(["QCM", "IMAGE", "OTHER"]).default("QCM"),
  text: z.string().trim().min(1).max(500),
  explanation: z.string().trim().max(1200).optional().or(z.literal("")),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  timeLimitSeconds: z.number().int().min(5).max(120).default(15),
  scoringGraceSeconds: z.number().int().min(0).max(120).default(6),
  visibility: visibilitySchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  answers: z.array(answerSchema).min(2).max(6)
});

const quizSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(800).optional().or(z.literal("")),
  visibility: visibilitySchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  questionIds: z.array(z.string().min(1)).min(1)
});

const userSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "TRAINER"]).default("TRAINER")
});

adminRouter.use(requireAuth);

adminRouter.get("/questions", async (req, res, next) => {
  try {
    const user = getAuthedUser(req);
    const questions = await prisma.bankQuestion.findMany({
      where: accessibleWhere(user.id),
      include: {
        owner: { select: { name: true, email: true } },
        answers: { orderBy: { order: "asc" } },
        tags: { include: { tag: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(questions.map(withFlatTags));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/questions", async (req, res, next) => {
  try {
    const user = getAuthedUser(req);
    const payload = bankQuestionSchema.parse(req.body);
    if (!payload.answers.some((answer) => answer.isCorrect)) {
      res.status(400).json({ error: "Au moins une bonne reponse est requise." });
      return;
    }

    const tagIds = await upsertTags(payload.tags);
    const question = await prisma.bankQuestion.create({
      data: {
        ownerId: user.id,
        visibility: payload.visibility,
        type: payload.type,
        text: payload.text,
        explanation: payload.explanation ?? "",
        imageUrl: normalizeOptional(payload.imageUrl),
        timeLimitSeconds: payload.timeLimitSeconds,
        scoringGraceSeconds: normalizeGraceSeconds(payload.scoringGraceSeconds, payload.timeLimitSeconds),
        answers: {
          create: payload.answers.map((answer, index) => ({
            text: answer.text,
            imageUrl: normalizeOptional(answer.imageUrl),
            isCorrect: answer.isCorrect,
            order: index + 1
          }))
        },
        tags: { create: tagIds.map((tagId) => ({ tagId })) }
      },
      include: {
        owner: { select: { name: true, email: true } },
        answers: { orderBy: { order: "asc" } },
        tags: { include: { tag: true } }
      }
    });

    res.status(201).json(withFlatTags(question));
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/quizzes", async (req, res, next) => {
  try {
    const user = getAuthedUser(req);
    const quizzes = await prisma.quiz.findMany({
      where: accessibleWhere(user.id),
      include: {
        owner: { select: { name: true, email: true } },
        tags: { include: { tag: true } },
        questions: {
          include: { answers: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(quizzes.map(withFlatTags));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/quizzes", async (req, res, next) => {
  try {
    const user = getAuthedUser(req);
    const payload = quizSchema.parse(req.body);
    const bankQuestions = await prisma.bankQuestion.findMany({
      where: { id: { in: payload.questionIds }, ...accessibleWhere(user.id) },
      include: { answers: { orderBy: { order: "asc" } } }
    });

    if (bankQuestions.length !== payload.questionIds.length) {
      res.status(400).json({ error: "Certaines questions selectionnees sont introuvables ou non partagees." });
      return;
    }

    const orderedQuestions = payload.questionIds.map((id) => {
      const question = bankQuestions.find((item) => item.id === id);
      if (!question) throw new Error("Question introuvable.");
      return question;
    });
    const tagIds = await upsertTags(payload.tags);

    const quiz = await prisma.quiz.create({
      data: {
        ownerId: user.id,
        visibility: payload.visibility,
        title: payload.title,
        description: normalizeOptional(payload.description),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        questions: {
          create: orderedQuestions.map((question, questionIndex) => ({
            type: question.type,
            sourceBankQuestionId: question.id,
            text: question.text,
            explanation: question.explanation ?? "",
            imageUrl: question.imageUrl,
            timeLimitSeconds: question.timeLimitSeconds,
            scoringGraceSeconds: question.scoringGraceSeconds,
            order: questionIndex,
            answers: {
              create: question.answers.map((answer) => ({
                text: answer.text,
                imageUrl: answer.imageUrl,
                isCorrect: answer.isCorrect,
                order: answer.order
              }))
            }
          }))
        }
      },
      include: {
        owner: { select: { name: true, email: true } },
        tags: { include: { tag: true } },
        questions: {
          include: { answers: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" }
        }
      }
    });

    res.status(201).json(withFlatTags(quiz));
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/questions/:id", async (req, res, next) => {
  try {
    const user = getAuthedUser(req);
    const payload = bankQuestionSchema.parse(req.body);
    const question = await prisma.bankQuestion.findFirst({
      where: writableWhere(req.params.id, user.id, user.role)
    });

    if (!question) {
      res.status(404).json({ error: "Question introuvable ou non modifiable." });
      return;
    }

    if (!payload.answers.some((answer) => answer.isCorrect)) {
      res.status(400).json({ error: "Au moins une bonne reponse est requise." });
      return;
    }

    const tagIds = await upsertTags(payload.tags);
    await prisma.$transaction([
      prisma.bankQuestionTag.deleteMany({ where: { bankQuestionId: question.id } }),
      prisma.bankAnswer.deleteMany({ where: { bankQuestionId: question.id } }),
      prisma.bankQuestion.update({
        where: { id: question.id },
        data: {
          visibility: payload.visibility,
          type: payload.type,
          text: payload.text,
          explanation: payload.explanation ?? "",
          imageUrl: normalizeOptional(payload.imageUrl),
          timeLimitSeconds: payload.timeLimitSeconds,
          scoringGraceSeconds: normalizeGraceSeconds(payload.scoringGraceSeconds, payload.timeLimitSeconds),
          answers: {
            create: payload.answers.map((answer, index) => ({
              text: answer.text,
              imageUrl: normalizeOptional(answer.imageUrl),
              isCorrect: answer.isCorrect,
              order: index + 1
            }))
          },
          tags: { create: tagIds.map((tagId) => ({ tagId })) }
        }
      })
    ]);

    const updatedQuestion = await prisma.bankQuestion.findUnique({
      where: { id: question.id },
      include: {
        owner: { select: { name: true, email: true } },
        answers: { orderBy: { order: "asc" } },
        tags: { include: { tag: true } }
      }
    });

    if (!updatedQuestion) {
      res.status(404).json({ error: "Question introuvable." });
      return;
    }

    res.json(withFlatTags(updatedQuestion));
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/quizzes/:id", async (req, res, next) => {
  try {
    const user = getAuthedUser(req);
    const payload = quizSchema.parse(req.body);
    const quiz = await prisma.quiz.findFirst({
      where: writableWhere(req.params.id, user.id, user.role)
    });

    if (!quiz) {
      res.status(404).json({ error: "Quiz introuvable ou non modifiable." });
      return;
    }

    const bankQuestions = await prisma.bankQuestion.findMany({
      where: { id: { in: payload.questionIds }, ...accessibleWhere(user.id) },
      include: { answers: { orderBy: { order: "asc" } } }
    });

    if (bankQuestions.length !== payload.questionIds.length) {
      res.status(400).json({ error: "Certaines questions selectionnees sont introuvables ou non partagees." });
      return;
    }

    const orderedQuestions = payload.questionIds.map((id) => {
      const question = bankQuestions.find((item) => item.id === id);
      if (!question) throw new Error("Question introuvable.");
      return question;
    });
    const tagIds = await upsertTags(payload.tags);

    await prisma.$transaction([
      prisma.quizTag.deleteMany({ where: { quizId: quiz.id } }),
      prisma.question.deleteMany({ where: { quizId: quiz.id } }),
      prisma.quiz.update({
        where: { id: quiz.id },
        data: {
          title: payload.title,
          description: normalizeOptional(payload.description),
          visibility: payload.visibility,
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
          questions: {
            create: orderedQuestions.map((question, questionIndex) => ({
              type: question.type,
              sourceBankQuestionId: question.id,
              text: question.text,
              explanation: question.explanation ?? "",
              imageUrl: question.imageUrl,
              timeLimitSeconds: question.timeLimitSeconds,
              scoringGraceSeconds: question.scoringGraceSeconds,
              order: questionIndex,
              answers: {
                create: question.answers.map((answer) => ({
                  text: answer.text,
                  imageUrl: answer.imageUrl,
                  isCorrect: answer.isCorrect,
                  order: answer.order
                }))
              }
            }))
          }
        }
      })
    ]);

    const updatedQuiz = await prisma.quiz.findUnique({
      where: { id: quiz.id },
      include: {
        owner: { select: { name: true, email: true } },
        tags: { include: { tag: true } },
        questions: {
          include: { answers: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" }
        }
      }
    });

    if (!updatedQuiz) {
      res.status(404).json({ error: "Quiz introuvable." });
      return;
    }

    res.json(withFlatTags(updatedQuiz));
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users", requireAdminRole, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users", requireAdminRole, async (req, res, next) => {
  try {
    const payload = userSchema.parse(req.body);
    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email.toLowerCase(),
        role: payload.role,
        passwordHash: hashPassword(payload.password)
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

function accessibleWhere(userId: string) {
  return {
    OR: [{ ownerId: userId }, { visibility: "ORGANIZATION" as const }]
  };
}

function getAuthedUser(req: unknown) {
  return (req as AuthenticatedRequest).user;
}

function writableWhere(id: string, userId: string, role: "ADMIN" | "TRAINER") {
  return role === "ADMIN" ? { id } : { id, ownerId: userId };
}

async function upsertTags(labels: string[]) {
  const uniqueLabels = [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
  const tags = await Promise.all(
    uniqueLabels.map((label) =>
      prisma.tag.upsert({
        where: { label },
        update: {},
        create: { label }
      })
    )
  );
  return tags.map((tag) => tag.id);
}

function withFlatTags<T extends { tags?: Array<{ tag: { label: string } }> }>(entity: T) {
  return {
    ...entity,
    tagLabels: entity.tags?.map((item) => item.tag.label) ?? []
  };
}

function normalizeOptional(value?: string) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function normalizeGraceSeconds(scoringGraceSeconds: number, timeLimitSeconds: number) {
  return Math.min(scoringGraceSeconds, timeLimitSeconds);
}
