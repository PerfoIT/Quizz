import { LogOut, Monitor, Play, Settings, SkipForward } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BrandShell } from "../components/BrandShell";
import { Logo } from "../components/Logo";
import { QRCodePanel } from "../components/QRCodePanel";
import { clearAuthToken, createHostSession, fetchQuizzes, getAuthToken } from "../lib/api";
import { socket } from "../lib/socket";
import type { Quiz, RevealedQuestion, SessionSnapshot, SocketAck } from "../lib/types";
import { getJoinUrl } from "../lib/urls";
import { useSocketEvent } from "../lib/useSocketEvent";

export default function HostPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizId, setQuizId] = useState("");
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [revealed, setRevealed] = useState<RevealedQuestion | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchQuizzes()
      .then((items) => {
        setQuizzes(items);
        setQuizId(items[0]?.id ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const updateSnapshot = useCallback((next: SessionSnapshot) => setSnapshot(next), []);
  useSocketEvent<SessionSnapshot>("session:participantsUpdated", updateSnapshot);
  useSocketEvent<SessionSnapshot>("question:started", (next) => {
    setRevealed(null);
    setSnapshot(next);
  });
  useSocketEvent<SessionSnapshot>("question:responsesUpdated", updateSnapshot);
  useSocketEvent<{ snapshot: SessionSnapshot; revealedQuestion: RevealedQuestion }>("question:revealed", (payload) => {
    setSnapshot(payload.snapshot);
    setRevealed(payload.revealedQuestion);
  });
  useSocketEvent<SessionSnapshot>("leaderboard:updated", updateSnapshot);
  useSocketEvent<SessionSnapshot>("session:finished", updateSnapshot);
  useSocketEvent<{ message: string }>("error", (payload) => setError(payload.message));

  function emit<T>(event: string, payload: Record<string, unknown>) {
    setError("");
    if (!socket.connected) socket.connect();
    socket.timeout(5000).emit(event, { ...payload, token: getAuthToken() }, (timeoutError: Error | null, ack: SocketAck<T>) => {
      if (timeoutError) {
        setError("Connexion temps reel indisponible. Verifiez le proxy /socket.io puis rechargez la page.");
        return;
      }
      if (!ack.ok) setError(ack.error);
      if (ack.ok && "snapshot" in ack) setSnapshot((ack as { snapshot: SessionSnapshot }).snapshot);
      if (ack.ok && "revealedQuestion" in ack) setRevealed((ack as { revealedQuestion: RevealedQuestion }).revealedQuestion);
    });
  }

  async function createSession() {
    if (!quizId) {
      setError("Aucun quiz disponible. Creez ou partagez un quiz dans l'administration.");
      return;
    }

    setError("");
    setIsCreating(true);
    try {
      const nextSnapshot = await createHostSession(quizId, sessionName);
      setSnapshot(nextSnapshot);
      if (!socket.connected) socket.connect();
      socket.emit("host:watchSession", { sessionCode: nextSnapshot.code });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de creer la session.");
    } finally {
      setIsCreating(false);
    }
  }

  const current = snapshot?.currentQuestion;
  const canStart = snapshot?.status === "WAITING";
  const canReveal = snapshot?.status === "QUESTION";
  const canNext = snapshot?.status === "REVEAL" || snapshot?.status === "LEADERBOARD";

  return (
    <BrandShell>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              <Settings className="h-4 w-4" /> Administration
            </Link>
            {snapshot && (
              <Link
                to={`/display/${snapshot.code}`}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
              >
                <Monitor className="h-4 w-4" /> Ouvrir le display
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                clearAuthToken();
                window.location.href = "/login";
              }}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              <LogOut className="h-4 w-4" /> Deconnexion
            </button>
          </div>
        </header>

        {error && <div className="rounded-md border border-red-400/30 bg-red-500/15 px-4 py-3 text-red-100">{error}</div>}

        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <aside className="glass rounded-lg p-5">
            <h1 className="text-2xl font-black">Console animateur</h1>
            <p className="mt-2 text-sm text-slate-300">Creez une session, laissez les participants entrer, puis pilotez le rythme du quiz.</p>

            <label className="mt-6 block text-sm font-semibold text-slate-200">Quiz</label>
            <select
              value={quizId}
              onChange={(event) => setQuizId(event.target.value)}
              className="mt-2 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-white"
            >
              {quizzes.map((quiz) => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.title} ({quiz.questionCount})
                </option>
              ))}
            </select>
            <label className="mt-4 block text-sm font-semibold text-slate-200">Nom de session</label>
            <input
              value={sessionName}
              onChange={(event) => setSessionName(event.target.value)}
              placeholder="Ex: Formation IA groupe matin"
              className="mt-2 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-white"
            />
            <button
              type="button"
              onClick={createSession}
              disabled={isCreating}
              className="mt-4 w-full rounded-md bg-perfo-blue px-4 py-3 font-bold text-white shadow-glow hover:bg-blue-500"
            >
              {isCreating ? "Creation..." : "Creer une session"}
            </button>

            {snapshot && (
              <div className="mt-6 space-y-4">
                <QRCodePanel url={getJoinUrl(snapshot.code)} code={snapshot.code} />
                <div className="grid grid-cols-2 gap-3 text-center">
                  <Stat label="Participants" value={snapshot.participants.length} />
                  <Stat label="Reponses" value={`${snapshot.responseCount}/${snapshot.participants.length}`} />
                </div>
              </div>
            )}
          </aside>

          <div className="space-y-5">
            <section className="glass rounded-lg p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-[0.22em] text-perfo-cyan">{snapshot?.status ?? "PRET"}</div>
                  <h2 className="mt-2 text-3xl font-black">{snapshot?.name ?? snapshot?.quiz.title ?? "Aucune session active"}</h2>
                </div>
                {snapshot && (
                  <div className="flex flex-wrap gap-2">
                    <Action disabled={!canStart} onClick={() => emit("host:startSession", { sessionCode: snapshot.code })} icon={<Play />}>
                      Demarrer
                    </Action>
                    <Action disabled={!canReveal} onClick={() => emit("host:revealAnswer", { sessionCode: snapshot.code })}>
                      Reveler
                    </Action>
                    <Action disabled={!canNext} onClick={() => emit("host:nextQuestion", { sessionCode: snapshot.code })} icon={<SkipForward />}>
                      Suivante
                    </Action>
                    <Action onClick={() => emit("host:endSession", { sessionCode: snapshot.code })}>Terminer</Action>
                  </div>
                )}
              </div>

              {current && (
                <div className="mt-6 rounded-lg border border-white/10 bg-slate-950/60 p-5">
                  <div className="text-sm text-slate-400">
                    Question {snapshot.currentQuestionIndex + 1} / {snapshot.quiz.questionCount}
                  </div>
                  <div className="mt-2 text-2xl font-bold">{current.text}</div>
                  {revealed?.explanation && <div className="mt-4 rounded-md bg-emerald-400/15 p-4 text-emerald-50">{revealed.explanation}</div>}
                </div>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="glass rounded-lg p-5">
                <h3 className="text-xl font-bold">Participants</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {snapshot?.participants.map((participant) => (
                    <span key={participant.joinedAt} className="rounded-md bg-white/10 px-3 py-2 text-sm font-semibold">
                      {participant.name}
                    </span>
                  ))}
                  {snapshot?.participants.length === 0 && <span className="text-slate-400">En attente des joueurs.</span>}
                </div>
              </div>
              <div className="glass rounded-lg p-5">
                <h3 className="text-xl font-bold">Rythme {snapshot?.quiz.paceMode === "MANUAL" ? "manuel" : "automatique"}</h3>
                <p className="mt-3 text-slate-300">
                  {snapshot?.quiz.paceMode === "MANUAL"
                    ? "La question se revele a la fin du chrono, puis l'animateur passe manuellement a la suivante."
                    : "La bonne reponse est affichee quelques secondes, puis la question suivante demarre automatiquement."}
                </p>
                {snapshot?.status === "FINISHED" && (
                  <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="text-sm uppercase tracking-[0.2em] text-perfo-cyan">Podium final disponible</div>
                    <div className="mt-2 text-2xl font-black">{snapshot.leaderboard[0]?.name ?? "Aucun participant"}</div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </BrandShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function Action({
  children,
  disabled,
  onClick,
  icon
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {icon && <span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      {children}
    </button>
  );
}
