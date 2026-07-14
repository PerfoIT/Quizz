import type { BankQuestion, Quiz } from "./types";

const serverUrl = import.meta.env.VITE_SERVER_URL || "";

export async function fetchQuizzes(): Promise<Quiz[]> {
  const response = await fetch(`${serverUrl}/api/quizzes`);
  if (!response.ok) throw new Error("Impossible de charger les quiz.");
  return response.json();
}

export async function adminLogin(password: string): Promise<string> {
  const response = await fetch(`${serverUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Connexion impossible.");
  return data.token;
}

export async function fetchBankQuestions(token: string): Promise<BankQuestion[]> {
  return adminFetch(token, "/api/admin/questions");
}

export async function createBankQuestion(
  token: string,
  payload: Omit<BankQuestion, "id" | "answers"> & {
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
  payload: { title: string; description?: string; questionIds: string[] }
) {
  return adminFetch(token, "/api/admin/quizzes", {
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
