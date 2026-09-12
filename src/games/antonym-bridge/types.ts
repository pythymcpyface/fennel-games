// Core domain types for Antonym Bridge (chain antonym hops from start to target).

export type Status = "in_progress" | "won" | "lost";
export type ErrorCode = "NOT_A_WORD" | "NOT_AN_ANTONYM" | "OUT_OF_MOVES" | "ALREADY_ENDED";

export interface Puzzle {
  puzzleId: string;
  startWord: string; // uppercase
  targetWord: string; // uppercase
  moveBudget: number;
  /** antonym adjacency: word -> its antonyms (uppercase). */
  antonyms: Record<string, string[]>;
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  currentWord: string;
  movesUsed: number;
  path: string[];
  status: Status;
}

export interface MoveResult { state: AttemptState; ok: boolean; error?: ErrorCode; }
