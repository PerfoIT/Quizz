import { Router } from "express";
import { listQuizzes } from "../services/sessionService.js";

export const quizzesRouter = Router();

quizzesRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await listQuizzes());
  } catch (error) {
    next(error);
  }
});

