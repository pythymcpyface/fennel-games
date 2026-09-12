// Core domain types for Fork. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-001 Fork; TERM-008 Trunk; TERM-009 Fork Point; TERM-010 Branch; TERM-012 Par.

/**
 * A daily puzzle: one start word + two targets (same length). The player builds a
 * shared trunk, forks, then two branches reaching each target. Par = minimum total
 * steps (trunk counted once + both branches), precomputed via BFS at build time.
 */
export interface Puzzle {
  puzzleId: string;
  start: string;
  targetA: string;
  targetB: string;
  wordLength: number;
  par: number;
}

/** Persisted per-day attempt state (TERM-023 session). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-008 trunk — starts at [start]; last element is the current trunk tip. */
  trunk: string[];
  /** FIELD-009 fork index into trunk (null until set). */
  forkIndex: number | null;
  /** FIELD-010/011 branches — each starts at the fork word. */
  branchA: string[];
  branchB: string[];
  isComplete: boolean;
}
