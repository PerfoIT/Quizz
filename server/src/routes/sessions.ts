import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../auth.js";
import { prisma } from "../db.js";
import { createSession } from "../services/sessionService.js";

export const sessionsRouter = Router();

const createSessionSchema = z.object({
  quizId: z.string().min(1),
  name: z.string().trim().max(120).optional().or(z.literal(""))
});

sessionsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const sessions = await prisma.session.findMany({
      where: { hostId: user.id },
      include: {
        quiz: { select: { title: true } },
        participants: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(
      sessions.map((session) => ({
        id: session.id,
        code: session.code,
        name: session.name,
        status: session.status,
        quizTitle: session.quiz.title,
        participantCount: session.participants.length,
        createdAt: session.createdAt,
        leaderboard: [...session.participants]
          .sort((a, b) => b.score - a.score || a.joinedAt.getTime() - b.joinedAt.getTime())
          .map((participant, index) => ({
            rank: index + 1,
            name: participant.name,
            score: participant.score
          }))
      }))
    );
  } catch (error) {
    next(error);
  }
});

sessionsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const { quizId, name } = createSessionSchema.parse(req.body);
    const snapshot = await createSession(quizId, user.id, name);
    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
});
