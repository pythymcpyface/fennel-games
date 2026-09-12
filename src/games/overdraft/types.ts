// Core domain types for Overdraft. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-003 Letter Set; TERM-005 Borrowed Letter; TERM-007 Borrow Penalty; TERM-009 Net Score.

export type ScoringMethod = "LETTER_SUM" | "LENGTH";

/**
 * A daily puzzle: a letter set (free to use, reusable), per-letter point values,
 * a borrow limit, and a per-borrow penalty. The player builds ONE word; letters
 * not in the set are "borrowed" (limited + penalised).
 */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-004 letter_set — uppercase letters usable without penalty. */
  letterSet: string[];
  /** FIELD-005 letter_points — value per letter A-Z. */
  letterPoints: Record<string, number>;
  scoringMethod: ScoringMethod;
  /** FIELD-007 max borrow limit (default 2). */
  maxBorrow: number;
  /** FIELD-008 penalty points per borrowed letter. */
  borrowPenalty: number;
}

/** FIELD-009..015 evaluation of a candidate word. */
export interface Evaluation {
  word: string;
  borrowedLetters: string[];
  borrowedCount: number;
  baseScore: number;
  penalty: number;
  netScore: number;
  overLimit: boolean;
  inDictionary: boolean;
}

/** Persisted per-day attempt state (TERM-023 session). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** the finalized word (empty until submitted). */
  finalWord: string;
  netScore: number;
  borrowedCount: number;
  isComplete: boolean;
}

export const DEFAULT_MAX_BORROW = 2;
