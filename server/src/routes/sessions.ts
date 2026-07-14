import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../auth.js";
import { createSession } from "../services/sessionService.js";

export const sessionsRouter = Router();

const createSessionSchema = z.object({
  quizId: z.string().min(1)
});

sessionsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const { quizId } = createSessionSchema.parse(req.body);
    const snapshot = await createSession(quizId, user.id);
    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
});
