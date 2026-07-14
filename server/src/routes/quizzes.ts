import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth.js";
import { listQuizzes } from "../services/sessionService.js";

export const quizzesRouter = Router();

quizzesRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    res.json(await listQuizzes((req as AuthenticatedRequest).user.id));
  } catch (error) {
    next(error);
  }
});
