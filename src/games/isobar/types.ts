// Core domain types for Isobar. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-003 Meaning Ring; TERM-004 Center (hidden); TERM-006 Near/Far hint.

/** FIELD-014 per-word hint status. */
export type HintStatus = "correct" | "off_by_one" | "other_incorrect";
/** FIELD-015 direction, only for off_by_one. */
export type HintDirection = "nearer" | "farther";

/**
 * A daily puzzle: 5 words, each with a correct ring index (0 = innermost/closest
 * to the hidden center). The center word is NEVER shipped — only ring indices,
 * precomputed at build time. Rings are 0..ringCount-1.
 */
export interface Puzzle {
  puzzleId: string;
  ringCount: number;
  /** the 5 words (uppercase), display order. */
  words: string[];
  /** FIELD-006 correct ring index per word (aligned to `words`). */
  correctRings: number[];
}

/** FIELD-013 per-word feedback after a submission. */
export interface WordHint {
  word: string;
  status: HintStatus;
  direction?: HintDirection;
}

/** FIELD-008/009 placement: ring index per word (null = unplaced). */
export type Placement = Array<number | null>;

/** Persisted per-day attempt state (TERM-017). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  placement: Placement;
  attempts: number;
  isSolved: boolean;
  /** per-attempt correct counts for the spoiler-safe share. */
  history: number[];
}

export const WORD_COUNT = 5;
