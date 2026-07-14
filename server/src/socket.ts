import type { Server } from "socket.io";
import { z } from "zod";
import { verifyToken } from "./auth.js";
import {
  createSession,
  ensureCanControlSession,
  getRevealedQuestion,
  getSessionSnapshot,
  joinSession,
  nextQuestion,
  reconnectParticipant,
  setSessionStatus,
  startQuestion,
  submitAnswer,
  updateParticipantSocket
} from "./services/sessionService.js";

const REVEAL_DURATION_MS = 6000;
const activeTimers = new Map<string, NodeJS.Timeout[]>();

const createSessionSchema = z.object({ quizId: z.string().min(1) });
const authenticatedCreateSessionSchema = createSessionSchema.extend({ token: z.string().min(1) });
const codeSchema = z.object({ sessionCode: z.string().trim().min(4).max(12) });
const authenticatedCodeSchema = codeSchema.extend({ token: z.string().min(1) });
const joinSchema = codeSchema.extend({
  name: z.string().trim().min(1).max(60),
  participantId: z.string().optional()
});
const answerSchema = z.object({
  participantId: z.string().min(1),
  answerOrder: z.number().int().min(1)
});

export function registerSockets(io: Server) {
  io.on("connection", (socket) => {
    socket.on("host:createSession", async (payload, callback) => {
      try {
        const { quizId, token } = authenticatedCreateSessionSchema.parse(payload);
        const user = verifyToken(token);
        if (!user) throw new Error("Connexion requise pour lancer un quiz.");
        const snapshot = await createSession(quizId, user.id);
        socket.join(room(snapshot.code));
        io.to(room(snapshot.code)).emit("session:created", snapshot);
        callback?.({ ok: true, snapshot });
      } catch (error) {
        emitError(socket, error, callback);
      }
    });

    socket.on("host:watchSession", async (payload, callback) => {
      try {
        const { sessionCode } = codeSchema.parse(payload);
        socket.join(room(sessionCode));
        const snapshot = await getSessionSnapshot(sessionCode);
        callback?.({ ok: true, snapshot });
      } catch (error) {
        emitError(socket, error, callback);
      }
    });

    socket.on("host:startSession", async (payload, callback) => {
      try {
        const { sessionCode } = authenticatedCodeSchema.parse(payload);
        const user = requireSocketUser(payload);
        await ensureCanControlSession(sessionCode, user.id);
        const snapshot = await runQuestionCycle(io, sessionCode);
        io.to(room(sessionCode)).emit("session:started", snapshot);
        callback?.({ ok: true, snapshot });
      } catch (error) {
        emitError(socket, error, callback);
      }
    });

    socket.on("host:nextQuestion", async (payload, callback) => {
      try {
        const { sessionCode } = authenticatedCodeSchema.parse(payload);
        const user = requireSocketUser(payload);
        await ensureCanControlSession(sessionCode, user.id);
        clearSessionTimers(sessionCode);
        const snapshot = await nextQuestion(sessionCode);
        if (snapshot.status === "FINISHED") {
          io.to(room(sessionCode)).emit("session:finished", snapshot);
          callback?.({ ok: true, snapshot });
          return;
        }
        const nextSnapshot = await runQuestionCycle(io, sessionCode);
        callback?.({ ok: true, snapshot: nextSnapshot });
      } catch (error) {
        emitError(socket, error, callback);
      }
    });

    socket.on("host:revealAnswer", async (payload, callback) => {
      try {
        const { sessionCode } = authenticatedCodeSchema.parse(payload);
        const user = requireSocketUser(payload);
        await ensureCanControlSession(sessionCode, user.id);
        clearSessionTimers(sessionCode);
        const snapshot = await setSessionStatus(sessionCode, "REVEAL");
        const revealedQuestion = await getRevealedQuestion(sessionCode);
        io.to(room(sessionCode)).emit("question:revealed", { snapshot, revealedQuestion });
        callback?.({ ok: true, snapshot, revealedQuestion });
      } catch (error) {
        emitError(socket, error, callback);
      }
    });

    socket.on("host:showLeaderboard", async (payload, callback) => {
      try {
        const { sessionCode } = authenticatedCodeSchema.parse(payload);
        const user = requireSocketUser(payload);
        await ensureCanControlSession(sessionCode, user.id);
        clearSessionTimers(sessionCode);
        const snapshot = await setSessionStatus(sessionCode, "LEADERBOARD");
        io.to(room(sessionCode)).emit("leaderboard:updated", snapshot);
        callback?.({ ok: true, snapshot });
      } catch (error) {
        emitError(socket, error, callback);
      }
    });

    socket.on("host:endSession", async (payload, callback) => {
      try {
        const { sessionCode } = authenticatedCodeSchema.parse(payload);
        const user = requireSocketUser(payload);
        await ensureCanControlSession(sessionCode, user.id);
        clearSessionTimers(sessionCode);
        const snapshot = await setSessionStatus(sessionCode, "FINISHED");
        io.to(room(sessionCode)).emit("session:finished", snapshot);
        callback?.({ ok: true, snapshot });
      } catch (error) {
        emitError(socket, error, callback);
      }
    });

    socket.on("player:join", async (payload, callback) => {
      try {
        const { sessionCode, name, participantId } = joinSchema.parse(payload);
        socket.join(room(sessionCode));
        const participant = participantId
          ? await reconnectParticipant(participantId, socket.id)
          : await joinSession(sessionCode, name, socket.id);
        const snapshot = await getSessionSnapshot(sessionCode);
        io.to(room(sessionCode)).emit("session:participantsUpdated", snapshot);
        callback?.({ ok: true, participantId: participant.id, snapshot });
      } catch (error) {
        emitError(socket, error, callback);
      }
    });

    socket.on("player:answer", async (payload, callback) => {
      try {
        const { participantId, answerOrder } = answerSchema.parse(payload);
        const response = await submitAnswer(participantId, answerOrder);
        const participant = await responseParticipantSession(participantId);
        const snapshot = await getSessionSnapshot(participant.session.code);
        io.to(room(participant.session.code)).emit("question:responsesUpdated", snapshot);
        callback?.({ ok: true, points: response.points, isCorrect: response.isCorrect, snapshot });
      } catch (error) {
        emitError(socket, error, callback);
      }
    });

    socket.on("disconnect", async () => {
      await updateParticipantSocket(socket.id, null);
    });
  });
}

function requireSocketUser(payload: unknown) {
  const parsed = z.object({ token: z.string().min(1) }).parse(payload);
  const user = verifyToken(parsed.token);
  if (!user) throw new Error("Connexion requise pour piloter une session.");
  return user;
}

async function runQuestionCycle(io: Server, sessionCode: string) {
  clearSessionTimers(sessionCode);
  const snapshot = await startQuestion(sessionCode);
  io.to(room(sessionCode)).emit("question:started", snapshot);

  const questionDurationMs = (snapshot.currentQuestion?.timeLimitSeconds ?? 15) * 1000;
  const revealTimer = setTimeout(async () => {
    try {
      const revealSnapshot = await setSessionStatus(sessionCode, "REVEAL");
      const revealedQuestion = await getRevealedQuestion(sessionCode);
      io.to(room(sessionCode)).emit("question:revealed", { snapshot: revealSnapshot, revealedQuestion });

      const nextTimer = setTimeout(async () => {
        try {
          const advancedSnapshot = await nextQuestion(sessionCode);
          if (advancedSnapshot.status === "FINISHED") {
            clearSessionTimers(sessionCode);
            io.to(room(sessionCode)).emit("session:finished", advancedSnapshot);
            return;
          }
          await runQuestionCycle(io, sessionCode);
        } catch (error) {
          emitRoomError(io, sessionCode, error);
        }
      }, REVEAL_DURATION_MS);
      pushTimer(sessionCode, nextTimer);
    } catch (error) {
      emitRoomError(io, sessionCode, error);
    }
  }, questionDurationMs);
  pushTimer(sessionCode, revealTimer);

  return snapshot;
}

function pushTimer(sessionCode: string, timer: NodeJS.Timeout) {
  const timers = activeTimers.get(sessionCode) ?? [];
  timers.push(timer);
  activeTimers.set(sessionCode, timers);
}

function clearSessionTimers(sessionCode: string) {
  const timers = activeTimers.get(sessionCode) ?? [];
  timers.forEach((timer) => clearTimeout(timer));
  activeTimers.delete(sessionCode);
}

async function responseParticipantSession(participantId: string) {
  const { prisma } = await import("./db.js");
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { session: true }
  });
  if (!participant) throw new Error("Participant introuvable.");
  return participant;
}

function room(code: string) {
  return `session:${code.toUpperCase()}`;
}

function emitError(socket: { emit: (event: string, payload: unknown) => void }, error: unknown, callback?: (payload: unknown) => void) {
  const message = error instanceof Error ? error.message : "Erreur inconnue.";
  socket.emit("error", { message });
  callback?.({ ok: false, error: message });
}

function emitRoomError(io: Server, sessionCode: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inconnue.";
  io.to(room(sessionCode)).emit("error", { message });
}
