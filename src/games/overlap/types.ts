// Core domain types for Overlap. Pure data. Mirrors spec Data Dictionary (FIELD-*)
// and Glossary (TERM-*).

/** FIELD-014 — per-letter reveal classification. */
export type RevealState = "EXACT" | "PRESENT" | "ABSENT";

/** FIELD-033 — guess validation outcome. */
export type GuessValidity = "VALID" | "INVALID_LENGTH" | "INVALID_CHARS" | "NOT_IN_DATASET";

/** FIELD-029 — platform identity. */
export type PlatformId = "web" | "ios" | "android";

/** Day-boundary rule for canonicalizing a timestamp to a dayId. */
export type DayBoundaryRule = "UTC";

/** A daily puzzle definition (TERM-002). Bridge is bundled but never displayed. */
export interface Puzzle {
  puzzleId: string;
  anchorA: string;
  anchorB: string;
  bridgeWord: string;
  /** convenience: bridgeWord.length */
  bridgeLength: number;
}

/** FIELD-015 — one row of per-letter reveal states. */
export type RevealRow = RevealState[];

/** Persisted per-day attempt state (TERM-025). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-016 — reveal rows, one per submitted guess. */
  revealGrid: RevealRow[];
  /** the actual guessed words, parallel to revealGrid (for share/dup checks). */
  guesses: string[];
  /** FIELD-010 — remaining guesses. */
  remainingGuesses: number;
  isSolved: boolean;
  isFailed: boolean;
  /** FIELD-019/020 — hint progress. */
  hintCountUsed: number;
  hintedPositions: number[];
}

export const MAX_GUESSES = 6;
