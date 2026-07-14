export type SessionStatus = "WAITING" | "QUESTION" | "REVEAL" | "LEADERBOARD" | "FINISHED";

export type Quiz = {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TRAINER";
};

export type PublicAnswer = {
  order: number;
  text: string;
  imageUrl: string | null;
};

export type PublicQuestion = {
  sourceBankQuestionId: string | null;
  type: "QCM" | "IMAGE" | "OTHER";
  order: number;
  text: string;
  imageUrl: string | null;
  timeLimitSeconds: number;
  scoringGraceSeconds: number;
  answers: PublicAnswer[];
};

export type RevealedQuestion = PublicQuestion & {
  explanation: string;
  correctAnswerOrder: number;
};

export type LeaderboardEntry = {
  name: string;
  score: number;
  rank: number;
};

export type SessionSnapshot = {
  code: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  joinUrl: string;
  quiz: Quiz;
  participants: Array<{ name: string; score: number; joinedAt: string }>;
  currentQuestion: PublicQuestion | null;
  responseCount: number;
  leaderboard: LeaderboardEntry[];
};

export type SocketAck<T = unknown> =
  | ({ ok: true } & T)
  | {
      ok: false;
      error: string;
    };

export type BankAnswer = {
  id: string;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
  order: number;
};

export type BankQuestion = {
  id: string;
  owner?: { name: string; email: string };
  visibility: "PRIVATE" | "ORGANIZATION";
  type: "QCM" | "IMAGE" | "OTHER";
  text: string;
  explanation: string;
  imageUrl: string | null;
  timeLimitSeconds: number;
  scoringGraceSeconds: number;
  answers: BankAnswer[];
  tagLabels?: string[];
};

export type AdminQuiz = {
  id: string;
  owner?: { name: string; email: string };
  visibility: "PRIVATE" | "ORGANIZATION";
  title: string;
  description: string | null;
  createdAt: string;
  questions: PublicQuestion[];
  tagLabels?: string[];
};
