// Core domain types for Undertow — a word-search where every target word is
// hidden ONLY spelled BACKWARDS. The player selects a straight line; the engine
// reverses the read letters and matches against targets. Forward-spelled DECOY
// words are traps: selecting one (read forward) is a mistake ("false current").
//
// Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-006 Target; TERM-008 Decoy; TERM-010 Selection Line; TERM-016 Mistake.

export interface Coord {
  row: number;
  col: number;
}

/** A word placed along a straight line, given by its endpoints (FIELD-009..012 / 015..018). */
export interface Placement {
  id: string;
  word: string;
  start: Coord;
  end: Coord;
}

/** A daily puzzle: a letter grid + reversed targets + forward decoys. */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-003 rowCount. */
  rows: number;
  /** FIELD-004 colCount. */
  cols: number;
  /** FIELD-005 grid — `rows` strings of length `cols` (uppercase A-Z). */
  grid: string[];
  /** Targets: each appears REVERSED along its line. */
  targets: Placement[];
  /** Decoys: each appears FORWARD along its line. */
  decoys: Placement[];
  /** FIELD-019 mistakeBudget (default 0 = perfect solve required). */
  mistakeBudget: number;
}

/** Persisted per-day attempt state (client state; TERM-018). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-020 foundTargetIds. */
  foundTargetIds: string[];
  /** FIELD-021 mistakeCount. */
  mistakeCount: number;
  /** true once the player ends the day (all found, or gives up). */
  isComplete: boolean;
}

/** FIELD-029 matchType — the outcome of resolving one selection. */
export type MatchType = "TARGET_MATCH" | "DECOY_MATCH" | "NO_MATCH" | "ALREADY_FOUND";
