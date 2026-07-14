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
      where: user.role === "ADMIN" ? {} : { hostId: user.id },
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

sessionsRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const session = await prisma.session.findFirst({
      where: user.role === "ADMIN" ? { id: req.params.id } : { id: req.params.id, hostId: user.id },
      select: { id: true }
    });

    if (!session) {
      res.status(404).json({ error: "Session introuvable ou non supprimable." });
      return;
    }

    await prisma.session.delete({ where: { id: session.id } });
    res.status(204).send();
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
