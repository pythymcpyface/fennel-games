// Core domain types for Driftword. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-001 Driftword; TERM-014 Target; TERM-015 Drift Rule; TERM-016 Word-ladder Path.

/**
 * A daily puzzle: a word-ladder path where each consecutive word differs by one
 * letter. Turn t is scored against path[min(t, len-1)] — the target DRIFTS one
 * step along the ladder per guess (deterministic, knowable — not adversarial).
 */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-005 path_words — 5-letter words, consecutive pairs differ by one letter. */
  path: string[];
}

/** Wordle-style per-letter feedback code. */
export type Mark = "G" | "Y" | "X"; // green / yellow / gray

/** FIELD-014 one guess row. */
export interface GuessRow {
  guess: string;
  /** FIELD-013 row_feedback — 5 marks vs the target that applied that turn. */
  marks: Mark[];
  /** the path index this guess was scored against (for transparency/tests). */
  targetIndex: number;
}

/** Persisted per-day attempt state (TERM-027). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  rows: GuessRow[];
  isSolved: boolean;
  isFailed: boolean;
}

/** FIELD-011 guess_budget. */
export const GUESS_BUDGET = 6;
export const WORD_LEN = 5;
