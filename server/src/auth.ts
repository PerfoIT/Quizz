import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db.js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TRAINER";
};

export type AuthenticatedRequest = Request & {
  user: AuthUser;
};

const TOKEN_TTL_SECONDS = 60 * 60 * 12;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) return false;
  const computed = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, "hex");
  return computed.length === stored.length && timingSafeEqual(computed, stored);
}

export function signToken(user: AuthUser) {
  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): AuthUser | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!safeEqual(signature, createSignature(encodedPayload))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AuthUser & {
      sub: string;
      exp: number;
    };
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role
    };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Connexion requise." });
    return;
  }
  (req as AuthenticatedRequest).user = user;
  next();
}

export function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (user.role !== "ADMIN") {
    res.status(403).json({ error: "Droits administrateur requis." });
    return;
  }
  next();
}

export function getTokenFromHeader(header?: string) {
  return header?.startsWith("Bearer ") ? header.slice(7) : "";
}

export function getRequestUser(req: Request) {
  const token = getTokenFromHeader(req.header("authorization"));
  return token ? verifyToken(token) : null;
}

export async function ensureInitialAdmin() {
  const email = process.env.ADMIN_EMAIL ?? "admin@perfo.local";
  const password = process.env.ADMIN_PASSWORD ?? "perfo-admin";
  const name = process.env.ADMIN_NAME ?? "Administrateur PERFO";

  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", name },
    create: {
      email,
      name,
      role: "ADMIN",
      passwordHash: hashPassword(password)
    }
  });
}

function createSignature(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function getAuthSecret() {
  return process.env.AUTH_SECRET ?? process.env.ADMIN_PASSWORD ?? "perfo-quiz-dev-secret";
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
