import { Edit3, LogOut, Plus, Save, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BrandShell } from "../components/BrandShell";
import { Logo } from "../components/Logo";
import {
  clearAuthToken,
  createAdminQuiz,
  createBankQuestion,
  createUser,
  deleteSessionHistoryItem,
  fetchAdminQuizzes,
  fetchBankQuestions,
  fetchSessionHistory,
  getAuthToken,
  updateBankQuestion,
  updateAdminQuiz
} from "../lib/api";
import type { AdminQuiz, BankQuestion, SessionHistoryItem } from "../lib/types";

type Tab = "questions" | "quizzes" | "history" | "users";
type Visibility = "PRIVATE" | "ORGANIZATION";
type DraftAnswer = { text: string; imageUrl: string; isCorrect: boolean };

const defaultAnswers: DraftAnswer[] = [
  { text: "", imageUrl: "", isCorrect: true },
  { text: "", imageUrl: "", isCorrect: false },
  { text: "", imageUrl: "", isCorrect: false },
  { text: "", imageUrl: "", isCorrect: false }
];

export default function AdminPage() {
  const token = getAuthToken();
  const [activeTab, setActiveTab] = useState<Tab>("questions");
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [quizzes, setQuizzes] = useState<AdminQuiz[]>([]);
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionTagFilter, setQuestionTagFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    type: "QCM" as BankQuestion["type"],
    text: "",
    explanation: "",
    imageUrl: "",
    timeLimitSeconds: 15,
    scoringGraceSeconds: 6,
    visibility: "PRIVATE" as Visibility,
    tagsText: "",
    answers: defaultAnswers
  });
  const [quizDraft, setQuizDraft] = useState({
    title: "",
    description: "",
    visibility: "PRIVATE" as Visibility,
    paceMode: "AUTO" as "AUTO" | "MANUAL",
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

  if (!token) return <Navigate to="/login" replace />;
  const adminToken = token;
  const filteredQuestions = filterQuestionsByTags(questions, questionTagFilter);

  async function refresh(nextToken = adminToken) {
    try {
      const [nextQuestions, nextQuizzes, nextHistory] = await Promise.all([
        fetchBankQuestions(nextToken),
        fetchAdminQuizzes(nextToken),
        fetchSessionHistory()
      ]);
      setQuestions(nextQuestions);
      setQuizzes(nextQuizzes);
      setHistory(nextHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    }
  }

  async function saveQuestion() {
    setError("");
    setMessage("");
    try {
      const payload = {
        type: draft.type,
        text: draft.text,
        explanation: draft.explanation,
        imageUrl: draft.imageUrl,
        timeLimitSeconds: draft.timeLimitSeconds,
        scoringGraceSeconds: Math.min(draft.scoringGraceSeconds, draft.timeLimitSeconds),
        visibility: draft.visibility,
        tags: parseTags(draft.tagsText),
        answers: draft.answers.filter((answer) => answer.text.trim())
      };
      if (editingQuestionId) {
        await updateBankQuestion(adminToken, editingQuestionId, payload);
        setMessage("Question modifiee.");
      } else {
        await createBankQuestion(adminToken, payload);
        setMessage("Question ajoutee a la banque.");
      }
      setDraft({
        type: "QCM",
        text: "",
        explanation: "",
        imageUrl: "",
        timeLimitSeconds: 15,
        scoringGraceSeconds: 6,
        visibility: "PRIVATE",
        tagsText: "",
        answers: defaultAnswers
      });
      setEditingQuestionId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation impossible.");
    }
  }

  async function saveQuiz() {
    setError("");
    setMessage("");
    const payload = {
      title: quizDraft.title,
      description: quizDraft.description,
      visibility: quizDraft.visibility,
      paceMode: quizDraft.paceMode,
      tags: parseTags(quizDraft.tagsText),
      questionIds: selectedQuestionIds
    };

    try {
      if (editingQuizId) {
        await updateAdminQuiz(adminToken, editingQuizId, payload);
        setMessage("Quiz modifie.");
      } else {
        await createAdminQuiz(adminToken, payload);
        setMessage("Quiz cree. Il est maintenant disponible dans /host.");
      }
      resetQuizForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement du quiz impossible.");
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

  async function deleteHistorySession(session: SessionHistoryItem) {
    const label = session.name || session.quizTitle || session.code;
    if (!window.confirm(`Supprimer la session "${label}" de l'historique ?`)) return;

    setError("");
    setMessage("");
    try {
      await deleteSessionHistoryItem(session.id);
      setHistory((items) => items.filter((item) => item.id !== session.id));
      setMessage("Session supprimee de l'historique.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    }
  }

  function editQuiz(quiz: AdminQuiz) {
    setActiveTab("quizzes");
    setEditingQuizId(quiz.id);
    setQuizDraft({
      title: quiz.title,
      description: quiz.description ?? "",
      visibility: quiz.visibility,
      paceMode: quiz.paceMode,
      tagsText: quiz.tagLabels?.join(", ") ?? ""
    });
    setSelectedQuestionIds(
      quiz.questions.map((question) => question.sourceBankQuestionId).filter(Boolean) as string[]
    );
    setMessage("");
    setError("");
  }

  function editQuestion(question: BankQuestion) {
    setActiveTab("questions");
    setEditingQuestionId(question.id);
    setDraft({
      type: question.type,
      text: question.text,
      explanation: question.explanation ?? "",
      imageUrl: question.imageUrl ?? "",
      timeLimitSeconds: question.timeLimitSeconds,
      scoringGraceSeconds: question.scoringGraceSeconds,
      visibility: question.visibility,
      tagsText: question.tagLabels?.join(", ") ?? "",
      answers: normalizeDraftAnswers(question.answers.map((answer) => ({
        text: answer.text,
        imageUrl: answer.imageUrl ?? "",
        isCorrect: answer.isCorrect
      })))
    });
    setMessage("");
    setError("");
  }

  function resetQuestionForm() {
    setEditingQuestionId(null);
    setDraft({
      type: "QCM",
      text: "",
      explanation: "",
      imageUrl: "",
      timeLimitSeconds: 15,
      scoringGraceSeconds: 6,
      visibility: "PRIVATE",
      tagsText: "",
      answers: defaultAnswers
    });
  }

  function resetQuizForm() {
    setEditingQuizId(null);
    setQuizDraft({ title: "", description: "", visibility: "PRIVATE", paceMode: "AUTO", tagsText: "" });
    setSelectedQuestionIds([]);
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
          <div className="flex flex-wrap gap-2">
            <Link to="/host" className="rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold">
              Console animateur
            </Link>
            <button
              type="button"
              onClick={() => {
                clearAuthToken();
                window.location.href = "/login";
              }}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold"
            >
              <LogOut className="h-4 w-4" /> Deconnexion
            </button>
          </div>
        </header>

        <div className="mt-8">
          <div className="text-sm uppercase tracking-[0.24em] text-perfo-cyan">Administration</div>
          <h1 className="mt-2 text-4xl font-black">Plateforme formateurs</h1>
        </div>

        {error && <div className="mt-5 rounded-md border border-red-400/30 bg-red-500/15 p-3 text-red-100">{error}</div>}
        {message && <div className="mt-5 rounded-md border border-emerald-400/30 bg-emerald-500/15 p-3 text-emerald-100">{message}</div>}

        <nav className="mt-6 flex flex-wrap gap-2">
          <TabButton active={activeTab === "questions"} onClick={() => setActiveTab("questions")}>Questions</TabButton>
          <TabButton active={activeTab === "quizzes"} onClick={() => setActiveTab("quizzes")}>Quiz</TabButton>
          <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>Historique</TabButton>
          <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")}>Utilisateurs</TabButton>
        </nav>

        {activeTab === "questions" && (
          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
            <div className="glass rounded-lg p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">{editingQuestionId ? "Modifier une question" : "Nouvelle question"}</h2>
                  <p className="mt-1 text-sm text-slate-300">Composez la question comme elle sera percue par les participants.</p>
                </div>
                {editingQuestionId && (
                  <button type="button" onClick={resetQuestionForm} className="rounded-md bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15">
                    Annuler
                  </button>
                )}
              </div>

              <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/70 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as BankQuestion["type"] })} className="admin-select max-w-48">
                    <option value="QCM">QCM texte</option>
                    <option value="IMAGE">Image a choisir</option>
                    <option value="OTHER">Autre</option>
                  </select>
                  <select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as Visibility })} className="admin-select max-w-64">
                    <option value="PRIVATE">Privee</option>
                    <option value="ORGANIZATION">Partagee avec les formateurs</option>
                  </select>
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Duree question
                    <input className="admin-input max-w-40" type="number" min={5} max={120} value={draft.timeLimitSeconds} onChange={(event) => setDraft({ ...draft, timeLimitSeconds: Number(event.target.value) })} />
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Decrement apres
                    <input
                      className="admin-input max-w-40"
                      type="number"
                      min={0}
                      max={draft.timeLimitSeconds}
                      value={draft.scoringGraceSeconds}
                      onChange={(event) => setDraft({ ...draft, scoringGraceSeconds: Number(event.target.value) })}
                    />
                  </label>
                </div>

                <textarea
                  className="mt-5 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] p-5 text-center text-2xl font-black leading-tight outline-none ring-perfo-blue focus:ring-2 md:text-4xl"
                  placeholder="Saisir la question"
                  value={draft.text}
                  onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                />
                <input className="admin-input mt-3" placeholder="URL image de la question (optionnel)" value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} />
                {draft.imageUrl && <img src={draft.imageUrl} alt="" className="mt-4 max-h-52 w-full rounded-lg object-cover" />}

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {draft.answers.map((answer, index) => (
                    <div key={index} className={`million-answer answer-tone-${index}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm font-black text-perfo-cyan">{String.fromCharCode(65 + index)}</span>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                          <input type="checkbox" checked={answer.isCorrect} onChange={(event) => updateAnswer(index, { isCorrect: event.target.checked })} />
                          Bonne reponse
                        </label>
                      </div>
                      <input className="mt-3 w-full bg-transparent text-lg font-bold outline-none placeholder:text-slate-500" placeholder={`Reponse ${String.fromCharCode(65 + index)}`} value={answer.text} onChange={(event) => updateAnswer(index, { text: event.target.value })} />
                      <input className="mt-2 w-full bg-transparent text-sm text-slate-300 outline-none placeholder:text-slate-600" placeholder="URL image optionnelle" value={answer.imageUrl} onChange={(event) => updateAnswer(index, { imageUrl: event.target.value })} />
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <textarea className="admin-input min-h-24" placeholder="Explication optionnelle" value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} />
                  <input className="admin-input" placeholder="Etiquettes separees par des virgules" value={draft.tagsText} onChange={(event) => setDraft({ ...draft, tagsText: event.target.value })} />
                </div>
              </div>

              <button type="button" onClick={saveQuestion} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-perfo-blue px-4 py-3 font-black shadow-glow">
                <Plus className="h-4 w-4" /> {editingQuestionId ? "Enregistrer la question" : "Ajouter a la banque"}
              </button>
            </div>

            <div className="glass rounded-lg p-5">
              <h2 className="text-2xl font-black">Banque de questions</h2>
              <input
                className="admin-input mt-4"
                placeholder="Rechercher par etiquettes, ex: ia, securite"
                value={questionTagFilter}
                onChange={(event) => setQuestionTagFilter(event.target.value)}
              />
              <div className="mt-4">
                <QuestionList questions={filteredQuestions} selectedQuestionIds={[]} onToggle={() => undefined} onEdit={editQuestion} selectable={false} editable />
              </div>
            </div>
          </section>
        )}

        {activeTab === "quizzes" && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
            <div className="glass rounded-lg p-5">
              <h2 className="text-2xl font-black">{editingQuizId ? "Modifier un quiz" : "Creer un quiz"}</h2>
              <div className="mt-4 grid gap-3">
                <input className="admin-input" placeholder="Titre du quiz" value={quizDraft.title} onChange={(event) => setQuizDraft({ ...quizDraft, title: event.target.value })} />
                <input className="admin-input" placeholder="Description" value={quizDraft.description} onChange={(event) => setQuizDraft({ ...quizDraft, description: event.target.value })} />
                <select value={quizDraft.visibility} onChange={(event) => setQuizDraft({ ...quizDraft, visibility: event.target.value as Visibility })} className="admin-select">
                  <option value="PRIVATE">Prive</option>
                  <option value="ORGANIZATION">Partage avec les formateurs</option>
                </select>
                <select value={quizDraft.paceMode} onChange={(event) => setQuizDraft({ ...quizDraft, paceMode: event.target.value as "AUTO" | "MANUAL" })} className="admin-select">
                  <option value="AUTO">Rythme automatique</option>
                  <option value="MANUAL">Rythme manuel</option>
                </select>
                <input className="admin-input" placeholder="Etiquettes du quiz" value={quizDraft.tagsText} onChange={(event) => setQuizDraft({ ...quizDraft, tagsText: event.target.value })} />
              </div>

              <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-3 text-sm font-bold text-slate-200">{selectedQuestionIds.length} question(s) selectionnee(s)</div>
                <QuestionList questions={questions} selectedQuestionIds={selectedQuestionIds} onToggle={toggleQuestion} selectable />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={saveQuiz} className="inline-flex items-center gap-2 rounded-md bg-perfo-blue px-4 py-3 font-black shadow-glow">
                  <Save className="h-4 w-4" /> {editingQuizId ? "Enregistrer" : "Creer le quiz"}
                </button>
                {editingQuizId && (
                  <button type="button" onClick={resetQuizForm} className="rounded-md bg-white/10 px-4 py-3 font-black hover:bg-white/15">
                    Annuler
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xl font-black">{quiz.title}</div>
                      <div className="mt-1 text-sm text-slate-300">
                        {quiz.questions.length} question(s) - {quiz.visibility === "ORGANIZATION" ? "Partage" : "Prive"}
                        {" "} - {quiz.paceMode === "AUTO" ? "Automatique" : "Manuel"}
                      </div>
                      {quiz.description && <p className="mt-2 text-sm text-slate-300">{quiz.description}</p>}
                    </div>
                    <button type="button" onClick={() => editQuiz(quiz)} className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15">
                      <Edit3 className="h-4 w-4" /> Modifier
                    </button>
                  </div>
                  {quiz.tagLabels && quiz.tagLabels.length > 0 && <Tags labels={quiz.tagLabels} />}
                </div>
              ))}
              {quizzes.length === 0 && <Empty text="Aucun quiz disponible." />}
            </div>
          </section>
        )}

        {activeTab === "history" && (
          <section className="mt-5 grid gap-3">
            {history.map((session) => (
              <div key={session.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-black">{session.name || session.quizTitle}</div>
                    <div className="mt-1 text-sm text-slate-300">
                      {session.quizTitle} - code {session.code} - {session.participantCount} participant(s) - {new Date(session.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{session.status}</Badge>
                    <button
                      type="button"
                      onClick={() => deleteHistorySession(session)}
                      className="rounded-md border border-red-400/30 bg-red-500/15 p-2 text-red-100 hover:bg-red-500/25"
                      title="Supprimer la session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {session.leaderboard.length > 0 && (
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {session.leaderboard.slice(0, 3).map((entry) => (
                      <div key={`${session.id}-${entry.rank}`} className="rounded-md bg-white/10 px-3 py-2">
                        <span className="font-mono text-perfo-cyan">#{entry.rank}</span> {entry.name} - {entry.score} pts
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {history.length === 0 && <Empty text="Aucune session dans l'historique." />}
          </section>
        )}

        {activeTab === "users" && (
          <section className="mt-5 glass rounded-lg p-5">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <Users className="h-5 w-5" /> Utilisateurs formateurs
            </h2>
            <p className="mt-2 text-sm text-slate-300">Reserve aux administrateurs. Le serveur refusera l'action si votre role ne le permet pas.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <input className="admin-input" placeholder="Nom" value={userDraft.name} onChange={(event) => setUserDraft({ ...userDraft, name: event.target.value })} />
              <input className="admin-input" placeholder="Email" value={userDraft.email} onChange={(event) => setUserDraft({ ...userDraft, email: event.target.value })} />
              <input className="admin-input" placeholder="Mot de passe" type="password" value={userDraft.password} onChange={(event) => setUserDraft({ ...userDraft, password: event.target.value })} />
              <select value={userDraft.role} onChange={(event) => setUserDraft({ ...userDraft, role: event.target.value as "ADMIN" | "TRAINER" })} className="admin-select">
                <option value="TRAINER">Formateur</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button type="button" onClick={saveUser} className="rounded-md bg-white/10 px-4 py-3 font-black hover:bg-white/15">
                Creer
              </button>
            </div>
          </section>
        )}
      </div>
    </BrandShell>
  );
}

function QuestionList({
  questions,
  selectedQuestionIds,
  onToggle,
  selectable,
  editable = false,
  onEdit
}: {
  questions: BankQuestion[];
  selectedQuestionIds: string[];
  onToggle: (id: string) => void;
  selectable: boolean;
  editable?: boolean;
  onEdit?: (question: BankQuestion) => void;
}) {
  if (questions.length === 0) return <Empty text="Aucune question dans la banque." />;

  return (
    <div className="grid max-h-[620px] gap-3 overflow-auto pr-1">
      {questions.map((question) => (
        <div
          key={question.id}
          className={`rounded-lg border p-4 text-left transition ${
            selectedQuestionIds.includes(question.id)
              ? "border-perfo-cyan bg-perfo-blue/20"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="font-black">{question.text}</div>
            <div className="flex flex-wrap gap-2">
              <Badge>{question.type}</Badge>
              <Badge>{question.visibility === "ORGANIZATION" ? "Partagee" : "Privee"}</Badge>
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-300">{question.answers.map((answer) => answer.text).join(" / ")}</div>
          {question.tagLabels && question.tagLabels.length > 0 && <Tags labels={question.tagLabels} />}
          <div className="mt-4 flex flex-wrap gap-2">
            {selectable && (
              <button type="button" onClick={() => onToggle(question.id)} className="rounded-md bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15">
                {selectedQuestionIds.includes(question.id) ? "Retirer" : "Ajouter au quiz"}
              </button>
            )}
            {editable && onEdit && (
              <button type="button" onClick={() => onEdit(question)} className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15">
                <Edit3 className="h-4 w-4" /> Modifier
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Tags({ labels }: { labels: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {labels.map((tag) => (
        <span key={tag} className="rounded-md bg-perfo-blue/20 px-2 py-1 text-xs font-bold text-perfo-cyan">
          {tag}
        </span>
      ))}
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold">{children}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/5 p-5 text-slate-300">{text}</div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-3 text-sm font-black transition ${
        active ? "bg-perfo-blue text-white shadow-glow" : "border border-white/10 bg-white/10 text-slate-200 hover:bg-white/15"
      }`}
    >
      {children}
    </button>
  );
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function filterQuestionsByTags(questions: BankQuestion[], filter: string) {
  const tags = parseTags(filter).map((tag) => tag.toLowerCase());
  if (tags.length === 0) return questions;
  return questions.filter((question) => {
    const questionTags = (question.tagLabels ?? []).map((tag) => tag.toLowerCase());
    return tags.every((tag) => questionTags.some((questionTag) => questionTag.includes(tag)));
  });
}

function normalizeDraftAnswers(answers: DraftAnswer[]) {
  const nextAnswers = [...answers];
  while (nextAnswers.length < 4) {
    nextAnswers.push({ text: "", imageUrl: "", isCorrect: false });
  }
  return nextAnswers.slice(0, 6);
}
