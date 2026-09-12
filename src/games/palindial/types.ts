// Core domain types for Palindial (reach a word's reverse-twin via 1-letter edits).

export type Status = "in_progress" | "won" | "lost";
export type ErrorCode = "NOT_IN_DICTIONARY" | "NOT_ONE_LETTER_CHANGE" | "WRONG_LENGTH" | "OUT_OF_MOVES" | "ALREADY_ENDED";

export interface Puzzle {
  puzzleId: string;
  startWord: string; // uppercase
  targetWord: string; // the reverse of startWord (also a real word)
  moveBudget: number;
  neighbors: Record<string, string[]>; // reachable edit-distance-1 subgraph
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
