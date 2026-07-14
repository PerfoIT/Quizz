import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { ensureInitialAdmin } from "./auth.js";
import { prisma } from "./db.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { quizzesRouter } from "./routes/quizzes.js";
import { sessionsRouter } from "./routes/sessions.js";
import { registerSockets } from "./socket.js";

const app = express();
const port = Number(process.env.SERVER_PORT ?? 3001);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

app.use(cors({ origin: corsOrigin === "*" ? true : corsOrigin, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/quizzes", quizzesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/sessions", sessionsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Erreur serveur.";
  res.status(400).json({ error: message });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin === "*" ? true : corsOrigin,
    credentials: true
  }
});

registerSockets(io);

ensureInitialAdmin()
  .then(() => {
    httpServer.listen(port, () => {
      console.log(`PERFO Quiz server listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error("Unable to initialize admin user", error);
    process.exit(1);
  });

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
});
