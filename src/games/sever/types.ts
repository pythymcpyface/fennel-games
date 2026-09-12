// Core domain types for Sever. Pure data. Mirrors spec Data Dictionary / Glossary.

export type PlatformId = "web" | "ios" | "android";
export type DayBoundaryRule = "UTC";

/** A daily puzzle: an unspaced string + its intended break positions (TERM-001). */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-006 — unspaced uppercase letters, e.g. "THERAPISTFINISHED". */
  puzzleString: string;
  /**
   * FIELD-009 — intended breaks. Length = puzzleString.length - 1. A true at
   * index i means a space between letter i and letter i+1 (gap index i+1 in 1-based
   * spec terms; here 0-based over gaps).
   */
  intendedBreaks: boolean[];
}

/** Persisted per-day attempt state (TERM-033). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-008 — candidate breaks; length = puzzleString.length - 1. */
  breaks: boolean[];
  attemptsUsed: number;
  isSolved: boolean;
  isFailed: boolean;
  /** FIELD-020 — revealed correct break gap indices (0-based over gaps). */
  revealedBreaks: number[];
  hintUsedCount: number;
  /** per-attempt feedback history for the share artifact. */
  history: SubmissionFeedback[];
}

/** FIELD-013/014 — feedback for one incorrect submission (TERM-015). */
export interface SubmissionFeedback {
  correctBreakCount: number;
  allTokensAreDictionaryWords: boolean;
}

export const ATTEMPT_LIMIT = 6;
