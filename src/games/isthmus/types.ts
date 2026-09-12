// Core domain types for Isthmus. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-002 Board; TERM-005 Word-Path; TERM-008 Shore-to-Shore; TERM-006 8-way adjacency.

export interface Coord {
  row: number;
  col: number;
}

/**
 * A daily puzzle: an R×C letter grid plus the intended solution path (a list of
 * coords from the top shore to the bottom shore spelling a dictionary word). The
 * solution is used only for the build-time gate + a reveal on give-up; runtime
 * validation is against adjacency + dictionary, not the stored solution.
 */
export interface Puzzle {
  puzzleId: string;
  rows: number;
  cols: number;
  /** FIELD-005 board_letters — grid[row][col] single uppercase letters. */
  grid: string[][];
  /** FIELD-019 intended solution path (top→bottom); its word is a dictionary word. */
  solution: Coord[];
}

/** FIELD-018 validation_status enum. */
export type ValidationStatus =
  | "EMPTY"
  | "NOT_ADJACENT"
  | "REUSED_TILE"
  | "NOT_SHORE_TO_SHORE"
  | "NOT_A_WORD"
  | "VALID";

/** Persisted per-day attempt state (TERM-024/025). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-007 selected_path — the player's current trace. */
  path: Coord[];
  attempts: number;
  isSolved: boolean;
  /** best (longest valid word) path length found, for share. */
  bestLen: number;
}
