import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const adminRouter = Router();

const adminToken = randomBytes(32).toString("hex");

const loginSchema = z.object({
  password: z.string().min(1)
});

const answerSchema = z.object({
  text: z.string().trim().min(1).max(300),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  isCorrect: z.boolean()
});

const bankQuestionSchema = z.object({
  type: z.enum(["QCM", "IMAGE", "OTHER"]).default("QCM"),
  text: z.string().trim().min(1).max(500),
  explanation: z.string().trim().min(1).max(1200),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  timeLimitSeconds: z.number().int().min(5).max(120).default(15),
  answers: z.array(answerSchema).min(2).max(6)
});

const quizSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(800).optional().or(z.literal("")),
  questionIds: z.array(z.string().min(1)).min(1)
});

adminRouter.post("/login", (req, res) => {
  const { password } = loginSchema.parse(req.body);
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "perfo-admin";

  if (!secureCompare(password, expectedPassword)) {
    res.status(401).json({ error: "Mot de passe incorrect." });
    return;
  }

  res.json({ token: adminToken });
});

adminRouter.use(requireAdmin);

adminRouter.get("/questions", async (_req, res, next) => {
  try {
    const questions = await prisma.bankQuestion.findMany({
      include: { answers: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" }
    });
    res.json(questions);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/questions", async (req, res, next) => {
  try {
    const payload = bankQuestionSchema.parse(req.body);
    if (!payload.answers.some((answer) => answer.isCorrect)) {
      res.status(400).json({ error: "Au moins une bonne reponse est requise." });
      return;
    }

    const question = await prisma.bankQuestion.create({
      data: {
        type: payload.type,
        text: payload.text,
        explanation: payload.explanation,
        imageUrl: normalizeOptional(payload.imageUrl),
        timeLimitSeconds: payload.timeLimitSeconds,
        answers: {
          create: payload.answers.map((answer, index) => ({
            text: answer.text,
            imageUrl: normalizeOptional(answer.imageUrl),
            isCorrect: answer.isCorrect,
            order: index + 1
          }))
        }
      },
      include: { answers: { orderBy: { order: "asc" } } }
    });

    res.status(201).json(question);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/quizzes", async (_req, res, next) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      include: {
        questions: {
          include: { answers: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(quizzes);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/quizzes", async (req, res, next) => {
  try {
    const payload = quizSchema.parse(req.body);
    const bankQuestions = await prisma.bankQuestion.findMany({
      where: { id: { in: payload.questionIds } },
      include: { answers: { orderBy: { order: "asc" } } }
    });

    if (bankQuestions.length !== payload.questionIds.length) {
      res.status(400).json({ error: "Certaines questions selectionnees sont introuvables." });
      return;
    }

    const orderedQuestions = payload.questionIds.map((id) => {
      const question = bankQuestions.find((item) => item.id === id);
      if (!question) throw new Error("Question introuvable.");
      return question;
    });

    const quiz = await prisma.quiz.create({
      data: {
        title: payload.title,
        description: normalizeOptional(payload.description),
        questions: {
          create: orderedQuestions.map((question, questionIndex) => ({
            type: question.type,
            text: question.text,
            explanation: question.explanation,
            imageUrl: question.imageUrl,
            timeLimitSeconds: question.timeLimitSeconds,
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
        questions: {
          include: { answers: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" }
        }
      }
    });

    res.status(201).json(quiz);
  } catch (error) {
    next(error);
  }
});

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || token !== adminToken) {
    res.status(401).json({ error: "Acces administrateur requis." });
    return;
  }

  next();
}

function normalizeOptional(value?: string) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function secureCompare(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  if (valueBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(valueBuffer, expectedBuffer);
}
