// Core domain types for Odd Sense. Pure data.

export type PlatformId = "web" | "ios" | "android";
export type DayBoundaryRule = "UTC";
export type PuzzleState = "in_progress" | "solved" | "failed";
export type GuessResult = "CORRECT" | "INCORRECT";

/** A daily puzzle (TERM-001): 5 words, one odd, plus reveal labels. */
export interface Puzzle {
  puzzleId: string;
  words: string[]; // exactly 5
  oddWordIndex: number; // 0..4
  themeLabel: string;
  oddCategoryLabel: string;
  /** Precomputed deterministic hint elimination target (a themed, non-odd index). */
  hintEliminationIndex: number;
}

export interface GuessRecord {
  attemptNumber: number;
  selectedWordIndex: number;
  result: GuessResult;
}

/** Persisted per-day attempt state (TERM-022 per-puzzle). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  state: PuzzleState;
  guessHistory: GuessRecord[];
  remainingAttempts: number;
  hintUsed: boolean;
  eliminatedWordIndex: number | null;
}

export const MAX_ATTEMPTS = 4;
export const WORDS_PER_PUZZLE = 5;
