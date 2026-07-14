import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { prisma } from "./db.js";
import { adminRouter } from "./routes/admin.js";
import { quizzesRouter } from "./routes/quizzes.js";
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

httpServer.listen(port, () => {
  console.log(`PERFO Quiz server listening on ${port}`);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
});
