// Core domain types for Ladderless. Pure data — no behavior, no platform APIs.
// Mirrors the spec Data Dictionary (FIELD-001..030) and Glossary (TERM-001..033).

/** FIELD-013 — warmer/colder verdict enum. */
export type Verdict = "warmer" | "colder" | "equal" | "best";

/** FIELD-016 — puzzle lifecycle status. */
export type PuzzleStatus = "not_started" | "in_progress" | "won";

/** FIELD-026 — platform identity set by the composition root. */
export type PlatformId = "pwa" | "ios" | "android";

/** Day-boundary rule for canonicalizing a timestamp to a dayId (REQ-001). */
export type DayBoundaryRule = "UTC";

/** A single accepted guess record (FIELD-017 element). */
export interface GuessRecord {
  /** FIELD-008 — 1-based, increments by 1 per accepted guess. */
  guessIndex: number;
  /** FIELD-007 — normalized guess word. */
  guessWord: string;
  /** FIELD-010 — 1-based similarity rank to target (1 = best/target). */
  semanticRank: number;
  /** FIELD-011 — coarse tier bucket derived from rank. */
  rankTier: number;
  /** FIELD-013 — verdict vs prior bestRank. */
  verdict: Verdict;
  /** FIELD-014 — true iff guessWord === targetWord. */
  isWin: boolean;
  /** FIELD-009 — unix ms, monotonic non-decreasing within a day. */
  guessTimestamp: number;
}

/** Persisted per-puzzle game state (TERM-021). */
export interface GameState {
  puzzleId: string;
  dayId: string;
  status: PuzzleStatus;
  guessHistory: GuessRecord[];
  /** FIELD-012 — best (lowest) rank achieved so far; defaults to vocabSize. */
  bestRank: number;
  hintCount: number;
  /** Words already handed out by the Hint button; excluded from future hints. */
  suggestedHints: string[];
}

/** Per-target rank table (TERM-008): word -> rank. Built at build time. */
export interface RankTable {
  targetWord: string;
  /** vocabulary size; used as the initial/worst bestRank. */
  vocabSize: number;
  /** word -> 1-based rank (1 = target). Covers the whole dictionary (RISK-005). */
  ranks: Record<string, number>;
  /** tier thresholds: ascending rank cutoffs; tier = count of cutoffs < rank. */
  tierCutoffs: number[];
}

/** A daily puzzle definition loaded from the content pack (TERM-001). */
export interface Puzzle {
  puzzleId: string;
  startWord: string;
  targetWord: string;
  parGuesses: number;
}
