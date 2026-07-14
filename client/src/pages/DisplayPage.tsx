import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AnswerGrid } from "../components/AnswerGrid";
import { BrandShell } from "../components/BrandShell";
import { Fireworks } from "../components/Fireworks";
import { Leaderboard } from "../components/Leaderboard";
import { Logo } from "../components/Logo";
import { QRCodePanel } from "../components/QRCodePanel";
import { socket } from "../lib/socket";
import type { RevealedQuestion, SessionSnapshot, SocketAck } from "../lib/types";
import { getJoinUrl } from "../lib/urls";
import { useCountdown } from "../lib/useCountdown";
import { useSocketEvent } from "../lib/useSocketEvent";

export default function DisplayPage() {
  const { sessionCode = "" } = useParams();
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [revealed, setRevealed] = useState<RevealedQuestion | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    socket.emit("host:watchSession", { sessionCode }, (ack: SocketAck<{ snapshot: SessionSnapshot }>) => {
      if (ack.ok) setSnapshot(ack.snapshot);
      else setError(ack.error);
    });
  }, [sessionCode]);

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

  return (
    <BrandShell>
      <div className="flex min-h-screen flex-col px-10 py-8">
        <header className="flex items-center justify-between">
          <Logo />
          <div className="font-mono text-4xl font-black tracking-[0.28em]">{sessionCode}</div>
        </header>

        {error && <div className="mt-8 rounded-md border border-red-400/30 bg-red-500/15 px-4 py-3 text-red-100">{error}</div>}

        <div className="grid flex-1 place-items-center py-8">
          {!snapshot && <div className="text-2xl text-slate-300">Connexion a la session...</div>}
          {snapshot?.status === "WAITING" && <Waiting snapshot={snapshot} />}
          {snapshot?.status === "QUESTION" && <Question snapshot={snapshot} />}
          {snapshot?.status === "REVEAL" && <Reveal snapshot={snapshot} revealed={revealed} />}
          {snapshot?.status === "LEADERBOARD" && <Transition />}
          {snapshot?.status === "FINISHED" && <Board snapshot={snapshot} title="Podium final" final />}
        </div>
      </div>
    </BrandShell>
  );
}

function Waiting({ snapshot }: { snapshot: SessionSnapshot }) {
  return (
    <section className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_260px]">
      <div>
        <div className="text-sm uppercase tracking-[0.28em] text-perfo-cyan">En attente des participants</div>
        <h1 className="mt-5 text-6xl font-black leading-tight">{snapshot.quiz.title}</h1>
        <p className="mt-5 max-w-2xl text-2xl text-slate-300">Scannez le QR code et entrez votre prenom pour rejoindre le quiz.</p>
        <div className="mt-8 text-3xl font-bold">{snapshot.participants.length} participant(s) connecte(s)</div>
      </div>
      <QRCodePanel url={getJoinUrl(snapshot.code)} code={snapshot.code} />
    </section>
  );
}

function Question({ snapshot }: { snapshot: SessionSnapshot }) {
  const question = snapshot.currentQuestion;
  const remaining = useCountdown(snapshot);
  if (!question) return null;
  return (
    <section className="w-full max-w-6xl">
      <div className="flex items-center justify-between gap-6">
        <div className="text-xl font-semibold text-perfo-cyan">
          Question {snapshot.currentQuestionIndex + 1} / {snapshot.quiz.questionCount}
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-perfo-blue px-5 py-3 text-2xl font-black shadow-glow">{remaining}s</div>
          <div className="rounded-md bg-white/10 px-5 py-3 text-xl font-bold">
            {snapshot.responseCount}/{snapshot.participants.length} reponses
          </div>
        </div>
      </div>
      <h1 className="mt-8 text-5xl font-black leading-tight">{question.text}</h1>
      {question.imageUrl && <img src={question.imageUrl} alt="" className="mt-6 max-h-64 w-full rounded-lg object-cover" />}
      <div className="mt-10">
        <AnswerGrid answers={question.answers} disabled />
      </div>
    </section>
  );
}

function Reveal({ snapshot, revealed }: { snapshot: SessionSnapshot; revealed: RevealedQuestion | null }) {
  const question = revealed ?? snapshot.currentQuestion;
  if (!question) return null;
  return (
    <section className="w-full max-w-6xl">
      <div className="text-xl font-semibold text-perfo-cyan">Bonne reponse</div>
      <h1 className="mt-5 text-5xl font-black leading-tight">{question.text}</h1>
      {question.imageUrl && <img src={question.imageUrl} alt="" className="mt-6 max-h-64 w-full rounded-lg object-cover" />}
      <div className="mt-8">
        <AnswerGrid answers={question.answers} correctAnswerOrder={revealed?.correctAnswerOrder} disabled />
      </div>
      {revealed?.explanation && <p className="mt-8 rounded-lg border border-emerald-300/25 bg-emerald-400/15 p-6 text-2xl text-emerald-50">{revealed.explanation}</p>}
    </section>
  );
}

function Board({ snapshot, title, final }: { snapshot: SessionSnapshot; title: string; final?: boolean }) {
  return (
    <section className="relative w-full max-w-4xl">
      {final && <Fireworks />}
      <div className="text-center">
        <div className="text-sm uppercase tracking-[0.28em] text-perfo-cyan">{final ? "Session terminee" : "Progression"}</div>
        <h1 className="mt-4 text-6xl font-black">{title}</h1>
      </div>
      <div className="mt-10">
        <Leaderboard entries={snapshot.leaderboard} />
      </div>
    </section>
  );
}

function Transition() {
  return <div className="text-3xl font-black text-slate-200">Question suivante...</div>;
}
