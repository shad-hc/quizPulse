
export interface ApiEnvelope<T> {
  success: boolean;
  message: string | null;
  data?: T;
  errors?: unknown;
}

export type UserRole = 'admin' | 'organizer' | 'user';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}


export interface AuthPayload extends TokenPair {
  user: User;
}


export interface MeResponse {
  user: User;
}

export type QuizStatus = 'draft' | 'active' | 'ended';


export interface QuizHost {
  _id: string;
  name: string;
  email: string;
}

export interface Quiz {
  _id: string;
  title: string;
  description?: string;
  status: QuizStatus;
  participantCount?: number;
  hostId: QuizHost | string | null;
  createdAt: string;
}


export interface QuizListResponse {
  quizzes: Quiz[];
}

export interface NewQuestion {
  text: string;
  options: string[];
  correctOptionIndex: number;
  points: number;
  timeLimitSeconds: number;
}


export interface ResultUser {
  _id: string;
  name: string;
  email: string;
}

export interface ResultEntry {
  _id: string;
  userId: ResultUser | string | null;
  totalScore: number;
  correctCount: number;
  questionsAttempted: number;
}

export interface LeaderboardEntry {
  userId: string;
  score: number;
  rank: number;
}


export interface QuizResultsPayload {
  results?: ResultEntry[];
  leaderboard?: LeaderboardEntry[];
}
