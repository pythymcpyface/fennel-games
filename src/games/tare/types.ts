// Core domain types for Tare — a tile-placement word game on a BALANCE BEAM.
// Each letter tile has a weight. The player splits the daily rack into a LEFT
// word and a RIGHT word; both must be real words, use every tile exactly once,
// and the two pans must balance (equal weight within tolerance — "tared").
//
// Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-004 Letter Tile; TERM-005 Tile Weight; TERM-006 Rack; TERM-010 Tolerance; TERM-011 Imbalance.

/** A single weighted letter tile (FIELD-004..006). */
export interface Tile {
  /** FIELD-004 tileId — unique within a puzzle. */
  id: string;
  /** FIELD-005 letter (uppercase A-Z). */
  letter: string;
  /** FIELD-006 weight (small integer). */
  weight: number;
}

/** A daily puzzle: a rack of weighted tiles + balance tolerance. */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-003 rackTiles. */
  rack: Tile[];
  /** FIELD-007 balanceTolerance. */
  tolerance: number;
}

/** Persisted per-day attempt state (client state). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** current LEFT word draft. */
  leftWord: string;
  /** current RIGHT word draft. */
  rightWord: string;
  /** true once a correct split has been submitted. */
  isComplete: boolean;
  /** best imbalance achieved (for share when complete). */
  imbalance: number;
}

/** FIELD-035 validation error codes. */
export type ValidationCode =
  | "OK"
  | "EMPTY_WORD"
  | "NOT_IN_DICTIONARY_LEFT"
  | "NOT_IN_DICTIONARY_RIGHT"
  | "RACK_MISMATCH"
  | "NOT_BALANCED";

/** Full evaluation of a proposed split. */
export interface Evaluation {
  leftWeight: number;
  rightWeight: number;
  /** FIELD-018 imbalance = |left - right|. */
  imbalance: number;
  isLeftValid: boolean;
  isRightValid: boolean;
  isRackExact: boolean;
  isBalanced: boolean;
  isSolved: boolean;
  code: ValidationCode;
}

/** FIELD-026 imbalance band for sharing. */
export type ImbalanceBand = "PERFECT" | "NEAR" | "OFF" | "UNSOLVED";
