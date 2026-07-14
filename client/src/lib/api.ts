import type { AdminQuiz, AuthUser, BankQuestion, Quiz, SessionSnapshot } from "./types";

const serverUrl = import.meta.env.VITE_SERVER_URL || "";
const tokenKey = "perfo-auth-token";

export function getAuthToken() {
  return localStorage.getItem(tokenKey) ?? localStorage.getItem("perfo-admin-token") ?? "";
}

export function setAuthToken(token: string) {
  localStorage.setItem(tokenKey, token);
  localStorage.setItem("perfo-admin-token", token);
}

export function clearAuthToken() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem("perfo-admin-token");
}

export async function fetchQuizzes(): Promise<Quiz[]> {
  const response = await fetch(`${serverUrl}/api/quizzes`, {
    headers: authHeaders()
  });
  if (!response.ok) throw new Error("Impossible de charger les quiz.");
  return response.json();
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch(`${serverUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Connexion impossible.");
  setAuthToken(data.token);
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await adminFetch<{ user: AuthUser }>(getAuthToken(), "/api/auth/me");
  return data.user;
}

export async function fetchBankQuestions(token: string): Promise<BankQuestion[]> {
  return adminFetch(token, "/api/admin/questions");
}

export async function createHostSession(quizId: string): Promise<SessionSnapshot> {
  const response = await fetch(`${serverUrl}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({ quizId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Impossible de creer la session.");
  return data;
}

export async function fetchAdminQuizzes(token: string): Promise<AdminQuiz[]> {
  return adminFetch(token, "/api/admin/quizzes");
}

export async function createBankQuestion(
  token: string,
  payload: {
    type: BankQuestion["type"];
    text: string;
    explanation: string;
    imageUrl?: string;
    timeLimitSeconds: number;
    visibility: "PRIVATE" | "ORGANIZATION";
    tags: string[];
    answers: Array<{ text: string; imageUrl?: string; isCorrect: boolean }>;
  }
): Promise<BankQuestion> {
  return adminFetch(token, "/api/admin/questions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createAdminQuiz(
  token: string,
  payload: { title: string; description?: string; visibility: "PRIVATE" | "ORGANIZATION"; tags: string[]; questionIds: string[] }
) {
  return adminFetch(token, "/api/admin/quizzes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createUser(
  token: string,
  payload: { name: string; email: string; password: string; role: "ADMIN" | "TRAINER" }
) {
  return adminFetch(token, "/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function adminFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Action admin impossible.");
  return data;
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function updateBankQuestion(
  token: string,
  questionId: string,
  payload: {
    type: BankQuestion["type"];
    text: string;
    explanation?: string;
    imageUrl?: string;
    timeLimitSeconds: number;
    visibility: "PRIVATE" | "ORGANIZATION";
    tags: string[];
    answers: Array<{ text: string; imageUrl?: string; isCorrect: boolean }>;
  }
): Promise<BankQuestion> {
  return adminFetch(token, `/api/admin/questions/${questionId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function updateAdminQuiz(
  token: string,
  quizId: string,
  payload: { title: string; description?: string; visibility: "PRIVATE" | "ORGANIZATION"; tags: string[]; questionIds: string[] }
) {
  return adminFetch(token, `/api/admin/quizzes/${quizId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}
