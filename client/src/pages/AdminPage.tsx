import { Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { BrandShell } from "../components/BrandShell";
import { Logo } from "../components/Logo";
import { clearAuthToken, createAdminQuiz, createBankQuestion, createUser, fetchBankQuestions, getAuthToken } from "../lib/api";
import type { BankQuestion } from "../lib/types";

type DraftAnswer = {
  text: string;
  imageUrl: string;
  isCorrect: boolean;
};

const defaultAnswers: DraftAnswer[] = [
  { text: "", imageUrl: "", isCorrect: true },
  { text: "", imageUrl: "", isCorrect: false },
  { text: "", imageUrl: "", isCorrect: false },
  { text: "", imageUrl: "", isCorrect: false }
];

export default function AdminPage() {
  const token = getAuthToken();
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    type: "QCM" as BankQuestion["type"],
    text: "",
    explanation: "",
    imageUrl: "",
    timeLimitSeconds: 15,
    visibility: "PRIVATE" as "PRIVATE" | "ORGANIZATION",
    tagsText: "",
    answers: defaultAnswers
  });
  const [quizDraft, setQuizDraft] = useState({
    title: "",
    description: "",
    visibility: "PRIVATE" as "PRIVATE" | "ORGANIZATION",
    tagsText: ""
  });
  const [userDraft, setUserDraft] = useState({
    name: "",
    email: "",
    password: "",
    role: "TRAINER" as "ADMIN" | "TRAINER"
  });

  useEffect(() => {
    if (!token) return;
    refresh(token);
  }, [token]);

  if (!token) return <Navigate to="/admin/login" replace />;
  const adminToken = token;

  async function refresh(nextToken = adminToken) {
    try {
      setQuestions(await fetchBankQuestions(nextToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    }
  }

  async function saveQuestion() {
    setError("");
    setMessage("");
    try {
      await createBankQuestion(adminToken, {
        type: draft.type,
        text: draft.text,
        explanation: draft.explanation,
        imageUrl: draft.imageUrl,
        timeLimitSeconds: draft.timeLimitSeconds,
        visibility: draft.visibility,
        tags: parseTags(draft.tagsText),
        answers: draft.answers.filter((answer) => answer.text.trim())
      });
      setDraft({ type: "QCM", text: "", explanation: "", imageUrl: "", timeLimitSeconds: 15, visibility: "PRIVATE", tagsText: "", answers: defaultAnswers });
      setMessage("Question ajoutee a la banque.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation impossible.");
    }
  }

  async function saveQuiz() {
    setError("");
    setMessage("");
    try {
      await createAdminQuiz(adminToken, {
        title: quizDraft.title,
        description: quizDraft.description,
        visibility: quizDraft.visibility,
        tags: parseTags(quizDraft.tagsText),
        questionIds: selectedQuestionIds
      });
      setQuizDraft({ title: "", description: "", visibility: "PRIVATE", tagsText: "" });
      setSelectedQuestionIds([]);
      setMessage("Quiz cree. Il est maintenant disponible dans /host.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation du quiz impossible.");
    }
  }

  async function saveUser() {
    setError("");
    setMessage("");
    try {
      await createUser(adminToken, userDraft);
      setUserDraft({ name: "", email: "", password: "", role: "TRAINER" });
      setMessage("Utilisateur cree.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation utilisateur impossible.");
    }
  }

  function updateAnswer(index: number, patch: Partial<DraftAnswer>) {
    setDraft((current) => ({
      ...current,
      answers: current.answers.map((answer, answerIndex) =>
        answerIndex === index ? { ...answer, ...patch } : answer
      )
    }));
  }

  function toggleQuestion(questionId: string) {
    setSelectedQuestionIds((current) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId]
    );
  }

  return (
    <BrandShell>
      <div className="mx-auto min-h-screen max-w-7xl px-5 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <button
            type="button"
            onClick={() => {
              clearAuthToken();
              window.location.href = "/admin/login";
            }}
            className="rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold"
          >
            Deconnexion
          </button>
        </header>

        <div className="mt-8">
          <div className="text-sm uppercase tracking-[0.24em] text-perfo-cyan">Administration</div>
          <h1 className="mt-2 text-4xl font-black">Banque de questions et creation de quiz</h1>
        </div>

        {error && <div className="mt-5 rounded-md border border-red-400/30 bg-red-500/15 p-3 text-red-100">{error}</div>}
        {message && <div className="mt-5 rounded-md border border-emerald-400/30 bg-emerald-500/15 p-3 text-emerald-100">{message}</div>}

        <section className="mt-6 grid gap-5 lg:grid-cols-[420px_1fr]">
          <div className="glass rounded-lg p-5">
            <h2 className="text-2xl font-black">Nouvelle question</h2>
            <div className="mt-4 grid gap-3">
              <select
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: event.target.value as BankQuestion["type"] })}
                className="rounded-md border border-white/10 bg-slate-950 px-3 py-3"
              >
                <option value="QCM">QCM texte</option>
                <option value="IMAGE">Image a choisir</option>
                <option value="OTHER">Autre</option>
              </select>
              <input className="admin-input" placeholder="Question" value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} />
              <input className="admin-input" placeholder="URL image de la question (optionnel)" value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} />
              <textarea className="admin-input min-h-24" placeholder="Explication" value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} />
              <select
                value={draft.visibility}
                onChange={(event) => setDraft({ ...draft, visibility: event.target.value as "PRIVATE" | "ORGANIZATION" })}
                className="rounded-md border border-white/10 bg-slate-950 px-3 py-3"
              >
                <option value="PRIVATE">Privee</option>
                <option value="ORGANIZATION">Partagee avec les formateurs</option>
              </select>
              <input className="admin-input" placeholder="Etiquettes separees par des virgules" value={draft.tagsText} onChange={(event) => setDraft({ ...draft, tagsText: event.target.value })} />
              <input
                className="admin-input"
                type="number"
                min={5}
                max={120}
                value={draft.timeLimitSeconds}
                onChange={(event) => setDraft({ ...draft, timeLimitSeconds: Number(event.target.value) })}
              />
            </div>
            <div className="mt-5 space-y-3">
              {draft.answers.map((answer, index) => (
                <div key={index} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold">Reponse {index + 1}</span>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={answer.isCorrect} onChange={(event) => updateAnswer(index, { isCorrect: event.target.checked })} />
                      Correcte
                    </label>
                  </div>
                  <input className="admin-input mt-3" placeholder="Texte" value={answer.text} onChange={(event) => updateAnswer(index, { text: event.target.value })} />
                  <input className="admin-input mt-2" placeholder="URL image optionnelle" value={answer.imageUrl} onChange={(event) => updateAnswer(index, { imageUrl: event.target.value })} />
                </div>
              ))}
            </div>
            <button type="button" onClick={saveQuestion} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-perfo-blue px-4 py-3 font-black shadow-glow">
              <Plus className="h-4 w-4" /> Ajouter a la banque
            </button>
          </div>

          <div className="space-y-5">
            <div className="glass rounded-lg p-5">
              <h2 className="text-2xl font-black">Creer un quiz</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input className="admin-input" placeholder="Titre du quiz" value={quizDraft.title} onChange={(event) => setQuizDraft({ ...quizDraft, title: event.target.value })} />
                <input className="admin-input" placeholder="Description" value={quizDraft.description} onChange={(event) => setQuizDraft({ ...quizDraft, description: event.target.value })} />
                <select
                  value={quizDraft.visibility}
                  onChange={(event) => setQuizDraft({ ...quizDraft, visibility: event.target.value as "PRIVATE" | "ORGANIZATION" })}
                  className="rounded-md border border-white/10 bg-slate-950 px-3 py-3"
                >
                  <option value="PRIVATE">Prive</option>
                  <option value="ORGANIZATION">Partage avec les formateurs</option>
                </select>
                <input className="admin-input" placeholder="Etiquettes du quiz" value={quizDraft.tagsText} onChange={(event) => setQuizDraft({ ...quizDraft, tagsText: event.target.value })} />
              </div>
              <div className="mt-4 text-sm text-slate-300">{selectedQuestionIds.length} question(s) selectionnee(s)</div>
              <button type="button" onClick={saveQuiz} className="mt-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-3 font-black hover:bg-white/15">
                <Save className="h-4 w-4" /> Creer le quiz
              </button>
            </div>

            <div className="grid gap-3">
              {questions.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => toggleQuestion(question.id)}
                  className={`rounded-lg border p-4 text-left transition ${
                    selectedQuestionIds.includes(question.id)
                      ? "border-perfo-cyan bg-perfo-blue/20"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-black">{question.text}</div>
                    <div className="flex flex-wrap gap-2">
                      <div className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold">{question.type}</div>
                      <div className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold">
                        {question.visibility === "ORGANIZATION" ? "Partagee" : "Privee"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{question.answers.map((answer) => answer.text).join(" / ")}</div>
                  {question.tagLabels && question.tagLabels.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {question.tagLabels.map((tag) => (
                        <span key={tag} className="rounded-md bg-perfo-blue/20 px-2 py-1 text-xs font-bold text-perfo-cyan">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
              {questions.length === 0 && <div className="rounded-lg border border-white/10 bg-white/5 p-5 text-slate-300">Aucune question dans la banque.</div>}
            </div>
          </div>
        </section>

        <section className="mt-5 glass rounded-lg p-5">
          <h2 className="text-2xl font-black">Utilisateurs formateurs</h2>
          <p className="mt-2 text-sm text-slate-300">Reserve aux administrateurs. Le serveur refusera l'action si votre role ne le permet pas.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <input className="admin-input" placeholder="Nom" value={userDraft.name} onChange={(event) => setUserDraft({ ...userDraft, name: event.target.value })} />
            <input className="admin-input" placeholder="Email" value={userDraft.email} onChange={(event) => setUserDraft({ ...userDraft, email: event.target.value })} />
            <input className="admin-input" placeholder="Mot de passe" type="password" value={userDraft.password} onChange={(event) => setUserDraft({ ...userDraft, password: event.target.value })} />
            <select value={userDraft.role} onChange={(event) => setUserDraft({ ...userDraft, role: event.target.value as "ADMIN" | "TRAINER" })} className="rounded-md border border-white/10 bg-slate-950 px-3 py-3">
              <option value="TRAINER">Formateur</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button type="button" onClick={saveUser} className="rounded-md bg-white/10 px-4 py-3 font-black hover:bg-white/15">
              Creer
            </button>
          </div>
        </section>
      </div>
    </BrandShell>
  );
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
