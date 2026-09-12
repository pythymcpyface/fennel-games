// Core domain types for Decay — a deterministic, turn-based typing/recall game.
// Target words DECAY: each tick hides one more letter (per a shipped decay order).
// Each submission advances one tick, so hesitation costs visibility. Type a word
// to LOCK it (score by remaining visibility); a word fully hidden while unlocked
// is LOST.
//
// Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-004 Decay Order; TERM-005 Tick; TERM-011 Locked; TERM-012 Lost; TERM-014 Lock Score.

export type WordStatus = "UNLOCKED" | "LOCKED" | "LOST";
export type CompletionStatus = "IN_PROGRESS" | "SOLVED" | "FAILED";

/** A target word + the order its letters are hidden across ticks (FIELD-004/007/008). */
export interface Target {
  word: string;
  /** FIELD-008 decayOrder — a permutation of [0..word.length-1]. */
  decayOrder: number[];
}

/** A daily puzzle. */
export interface Puzzle {
  puzzleId: string;
  targets: Target[];
  /** FIELD-024 lockThreshold — solved when lockCount >= this (default all). */
  lockThreshold: number;
}

/** Per-word runtime status. */
export interface WordState {
  status: WordStatus;
  /** FIELD-014 lockedAtTick / FIELD-015 lostAtTick. */
  atTick: number | null;
  /** visibility at lock time (for scoring/share). */
  lockedVisibility: number | null;
}

/** Persisted per-day attempt state (TERM-023). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-009 tick. */
  tick: number;
  words: WordState[];
  /** FIELD-020 totalScore. */
  score: number;
  /** FIELD-023 completionStatus. */
  status: CompletionStatus;
}

/** Share outcome tier (FIELD-025). */
export type OutcomeTier = "HIGH_LOCK" | "LOW_LOCK" | "LOST" | "UNLOCKED";
