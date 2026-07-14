import { CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AnswerGrid } from "../components/AnswerGrid";
import { BrandShell } from "../components/BrandShell";
import { Fireworks } from "../components/Fireworks";
import { Leaderboard } from "../components/Leaderboard";
import { Logo } from "../components/Logo";
import { socket } from "../lib/socket";
import type { RevealedQuestion, SessionSnapshot, SocketAck } from "../lib/types";
import { useCountdown } from "../lib/useCountdown";
import { useSocketEvent } from "../lib/useSocketEvent";

export default function PlayerPage() {
  const { sessionCode = "" } = useParams();
  const storageKey = useMemo(() => `perfo-quiz:${sessionCode}:participant`, [sessionCode]);
  const [name, setName] = useState("");
  const [participantId, setParticipantId] = useState(() => localStorage.getItem(storageKey) ?? "");
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [revealed, setRevealed] = useState<RevealedQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ points: number; isCorrect: boolean } | null>(null);
  const [error, setError] = useState("");
  const remaining = useCountdown(snapshot);

  const join = useCallback(() => {
    const savedName = name || localStorage.getItem(`${storageKey}:name`) || "Participant";
    socket.emit(
      "player:join",
      { sessionCode, name: savedName, participantId: participantId || undefined },
      (ack: SocketAck<{ participantId: string; snapshot: SessionSnapshot }>) => {
        if (!ack.ok) {
          setError(ack.error);
          if (participantId) {
            localStorage.removeItem(storageKey);
            setParticipantId("");
          }
          return;
        }
        setError("");
        setSnapshot(ack.snapshot);
        setParticipantId(ack.participantId);
        localStorage.setItem(storageKey, ack.participantId);
        localStorage.setItem(`${storageKey}:name`, savedName);
      }
    );
  }, [name, participantId, sessionCode, storageKey]);

  useEffect(() => {
    if (participantId) join();
  }, []);

  const updateSnapshot = useCallback((next: SessionSnapshot) => setSnapshot(next), []);
  useSocketEvent<SessionSnapshot>("session:participantsUpdated", updateSnapshot);
  useSocketEvent<SessionSnapshot>("question:started", (next) => {
    setSelected(null);
    setAnswerResult(null);
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

  function answer(answerOrder: number) {
    if (!participantId) return;
    setSelected(answerOrder);
    socket.emit("player:answer", { participantId, answerOrder }, (ack: SocketAck<{ points: number; isCorrect: boolean; snapshot: SessionSnapshot }>) => {
      if (!ack.ok) {
        setError(ack.error);
        return;
      }
      setAnswerResult({ points: ack.points, isCorrect: ack.isCorrect });
      setSnapshot(ack.snapshot);
    });
  }

  const ownRank = snapshot?.leaderboard.find((entry) => entry.name === (name || localStorage.getItem(`${storageKey}:name`)));

  return (
    <BrandShell>
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-5">
        <header className="flex items-center justify-between">
          <Logo />
          <div className="font-mono text-xl font-black tracking-[0.22em]">{sessionCode}</div>
        </header>

        {error && <div className="mt-5 rounded-md border border-red-400/30 bg-red-500/15 px-4 py-3 text-red-100">{error}</div>}

        {!participantId && (
          <section className="mt-10 glass rounded-lg p-5">
            <h1 className="text-3xl font-black">Rejoindre le quiz</h1>
            <p className="mt-2 text-slate-300">Entrez votre prenom et restez sur cette page pendant toute la session.</p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Prenom Nom"
              className="mt-6 w-full rounded-md border border-white/10 bg-slate-950 px-4 py-4 text-lg outline-none ring-perfo-blue focus:ring-2"
            />
            <button
              type="button"
              onClick={join}
              className="mt-4 w-full rounded-md bg-perfo-blue px-4 py-4 text-lg font-black shadow-glow"
            >
              Entrer
            </button>
          </section>
        )}

        {participantId && snapshot && (
          <section className="mt-8 flex flex-1 flex-col">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-sm uppercase tracking-[0.2em] text-perfo-cyan">{snapshot.status}</div>
              <div className="mt-1 text-2xl font-black">{snapshot.quiz.title}</div>
              <div className="mt-3 text-sm text-slate-300">
                {snapshot.status === "QUESTION"
                  ? "Score masque pendant la question"
                  : `Score ${ownRank?.score ?? 0} pts ${ownRank ? `- rang ${ownRank.rank}` : ""}`}
              </div>
            </div>

            {snapshot.status === "WAITING" && <Centered title="Vous etes connecte" text="Le quiz va demarrer sur l'ecran principal." />}

            {snapshot.status === "QUESTION" && snapshot.currentQuestion && (
              <div className="mt-6">
                <div className="text-sm font-semibold text-perfo-cyan">
                  Question {snapshot.currentQuestionIndex + 1} / {snapshot.quiz.questionCount}
                </div>
                <div className="mt-3 inline-flex rounded-md bg-perfo-blue px-4 py-2 text-xl font-black shadow-glow">
                  {remaining}s
                </div>
                <h2 className="mt-3 text-2xl font-black leading-tight">{snapshot.currentQuestion.text}</h2>
                {snapshot.currentQuestion.imageUrl && (
                  <img src={snapshot.currentQuestion.imageUrl} alt="" className="mt-4 max-h-56 w-full rounded-lg object-cover" />
                )}
                <div className="mt-5">
                  <AnswerGrid answers={snapshot.currentQuestion.answers} selected={selected} onSelect={answer} />
                </div>
                {selected && (
                  <div className="mt-5 flex items-center gap-3 rounded-lg border border-white/10 bg-white/10 p-4 text-slate-100">
                    <CheckCircle2 className="h-6 w-6 text-perfo-cyan" />
                    Reponse envoyee. Vous pouvez la modifier jusqu'a la fin du chrono.
                  </div>
                )}
              </div>
            )}

            {snapshot.status === "REVEAL" && revealed && (
              <div className="mt-6">
                {revealed.imageUrl && <img src={revealed.imageUrl} alt="" className="mb-4 max-h-56 w-full rounded-lg object-cover" />}
                <AnswerGrid answers={revealed.answers} selected={selected} correctAnswerOrder={revealed.correctAnswerOrder} disabled />
                {revealed.explanation && <p className="mt-5 rounded-lg border border-emerald-300/25 bg-emerald-400/15 p-4 text-emerald-50">{revealed.explanation}</p>}
                {answerResult && (
                  <div className="mt-4 rounded-lg border border-white/10 bg-white/10 p-4 text-xl font-black">
                    {answerResult.isCorrect ? `+${answerResult.points} points` : "0 point"}
                  </div>
                )}
              </div>
            )}

            {snapshot.status === "LEADERBOARD" && <Centered title="Question suivante" text="Restez pret, le quiz continue." />}

            {snapshot.status === "FINISHED" && (
              <div className="relative mt-6">
                <Fireworks />
                <h2 className="mb-4 text-2xl font-black">Podium final</h2>
                <Leaderboard entries={snapshot.leaderboard} compact />
              </div>
            )}
          </section>
        )}
      </div>
    </BrandShell>
  );
}

function Centered({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid flex-1 place-items-center py-16 text-center">
      <div>
        <div className="text-3xl font-black">{title}</div>
        <p className="mt-3 text-slate-300">{text}</p>
      </div>
    </div>
  );
}
