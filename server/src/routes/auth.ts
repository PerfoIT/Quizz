import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, signToken, verifyPassword, type AuthenticatedRequest } from "../auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: payload.email.toLowerCase() } });
    if (!user || !verifyPassword(payload.password, user.passwordHash)) {
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    res.json({ token: signToken(publicUser), user: publicUser });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: (req as AuthenticatedRequest).user });
});
