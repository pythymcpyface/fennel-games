// Core domain types for Parallax. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-001 Parallax; TERM-004 Anchor; TERM-005 Target; TERM-010 Balance; TERM-011 Closeness.

/** FIELD-010 balanceClass — which anchor a guess leans toward (TERM-010). */
export type BalanceClass = "A" | "B" | "BALANCED";

/**
 * A daily puzzle. Ships anchors + a per-guess feedback table so runtime never
 * needs vectors (TERM-030 on-device validation). The target is the intended
 * semantic midpoint (TERM-009).
 */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-003 anchor A (uppercase). */
  anchorA: string;
  /** FIELD-004 anchor B (uppercase). */
  anchorB: string;
  /** FIELD-005 target word (the midpoint answer) — needed for win check. */
  target: string;
  /**
   * Precomputed feedback per candidate guess: balanceClass + closenessBand (0..9).
   * Built from GloVe at build time; a pure lookup at runtime. Optional at rest when
   * the pack ships a shared vocabulary + packed codes (see PackedPuzzle).
   */
  table: Record<string, { balance: BalanceClass; closeness: number }>;
}

/**
 * Compact on-disk puzzle: instead of a per-word object map, ships a `codes` string
 * with one char per shared-vocab word. Each code packs balance (0=A,1=BALANCED,2=B)
 * and closeness (0..9) as `balance*10 + closeness`, base-36 encoded to one char.
 * Rehydrated to a Puzzle against the pack's shared `vocab`.
 */
export interface PackedPuzzle {
  puzzleId: string;
  anchorA: string;
  anchorB: string;
  target: string;
  codes: string;
}

/** FIELD-009 one guess row (TERM-013). */
export interface GuessRow {
  guess: string;
  balance: BalanceClass;
  /** FIELD-012 closenessBand — 0 (far) .. 9 (at the midpoint). */
  closeness: number;
}

/** Persisted per-day attempt state (TERM-014). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  rows: GuessRow[];
  isSolved: boolean;
  isFailed: boolean;
}

/** FIELD-006 guessBudget (TERM-014). */
export const GUESS_BUDGET = 12;
/** FIELD-012 closeness is banded 0..9; 9 means the target itself. */
export const CLOSENESS_MAX = 9;
