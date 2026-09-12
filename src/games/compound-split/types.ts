// Core domain types for Compound Split. Pure data.

export type Status = "in_progress" | "won" | "lost";
export type Feedback = "CORRECT" | "INCORRECT" | "ALREADY_LOCKED" | "INVALID_SELECTION" | "NO_ATTEMPTS_LEFT";

/** A daily puzzle: 8 halves + 4 target compounds (each = two halves concatenated). */
export interface Puzzle {
  puzzleId: string;
  halves: string[]; // 8, uppercase
  compounds: string[]; // 4 target compounds, uppercase
}

export interface LockedPair {
  leftIndex: number;
  rightIndex: number;
  compound: string;
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  lockedPairs: LockedPair[];
  attemptsUsed: number;
  status: Status;
  hintUsed: boolean;
  history: boolean[]; // per submission: true=correct
}

export const ATTEMPT_LIMIT = 5;
export const HALF_COUNT = 8;
export const COMPOUND_COUNT = 4;
