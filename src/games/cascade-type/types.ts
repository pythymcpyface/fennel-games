// Core domain types for Cascade Type — a deterministic, turn-based typing game.
// A daily cascade is an ordered stack of word rows (bottom-to-top). Only the
// exposed (bottom uncleared) row is clearable. Typing a word clears it, scoring
// base points (length) + an ADJACENCY BONUS when it shares a letter with the
// previously-cleared word; linked clears build a combo multiplier.
//
// Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-004 Cascade; TERM-013 Adjacency Bonus; TERM-014 Cascade Link; TERM-015 Combo.

/** A daily puzzle: rows of words, bottom-to-top (row 0 is the bottom/exposed first). */
export interface Puzzle {
  puzzleId: string;
  rows: string[][];
}

/** Persisted per-day attempt state (TERM-019). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-008 clearedWordIds — "row:idx" tokens. */
  cleared: string[];
  /** FIELD-007 exposedRowIndex. */
  exposedRow: number;
  /** FIELD-012 lastClearedWordText (lowercase) or null. */
  lastWord: string | null;
  /** FIELD-015 comboCount. */
  combo: number;
  /** FIELD-016 comboMax. */
  comboMax: number;
  /** FIELD-019 scoreTotal. */
  score: number;
  /** FIELD-023 isSolved. */
  isComplete: boolean;
}

/** FIELD-025/026 share bands. */
export type Band = "D" | "C" | "B" | "A" | "S";
