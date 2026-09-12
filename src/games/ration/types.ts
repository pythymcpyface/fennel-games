// Core domain types for Ration. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-006 Letter Inventory; TERM-011 Target Histogram; TERM-028 Inventory Accounting.

/** A letter-count multiset, e.g. { A: 3, E: 2, R: 1 }. Keys are uppercase A-Z. */
export type LetterCounts = Record<string, number>;

/** One target-histogram bucket: need `count` words of exactly `length` letters. */
export interface TargetBucket {
  length: number;
  count: number;
}

/**
 * A daily puzzle: a shared consumable letter inventory + a word-length target
 * histogram. Every letter used across ALL words is spent from the inventory.
 */
export interface Puzzle {
  puzzleId: string;
  inventory: LetterCounts;
  targets: TargetBucket[];
}

/** Persisted per-day attempt state (TERM-014 session). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** words submitted so far (uppercase, unique). */
  words: string[];
  isComplete: boolean;
}
