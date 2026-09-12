// Core domain types for Degrees. Pure data.

export type Status = "in_progress" | "solved" | "failed";

/** A daily puzzle: words in canonical (weakest→strongest) order + scale label. */
export interface Puzzle {
  puzzleId: string;
  /** words already in canonical order (index i = strength rank i). */
  words: string[]; // length 5
  scaleLabel: string;
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** current arrangement as indices into puzzle.words (canonical index per slot). */
  order: number[];
  lockedPositions: boolean[];
  attemptsUsed: number;
  status: Status;
  hintUses: number;
  history: number[]; // correct-position count per attempt
}

export const ATTEMPT_LIMIT = 6;
export const SET_SIZE = 5;
