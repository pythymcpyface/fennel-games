// Core domain types for Fogline — a word search that starts almost entirely
// FOGGED. Only a seed region is visible. Finding a target reveals its cells plus
// a neighbourhood (fog recedes by a radius), progressively unlocking the letters
// needed to spot later words. You cannot select cells that are still fogged.
//
// Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-008 Fog; TERM-010 Seed Reveal; TERM-019 Fog Reveal Radius; TERM-020 Reveal Neighborhood.

export interface Coord {
  row: number;
  col: number;
}

export type DistanceMetric = "CHEBYSHEV" | "MANHATTAN";

/** A target word placed on a straight line, given by start + direction (forward read). */
export interface Target {
  /** FIELD-014 targetId — unique in puzzle. */
  id: string;
  /** FIELD-015 targetText. */
  word: string;
  /** FIELD-016/017 start cell. */
  start: Coord;
  /** FIELD-018/019 unit direction (dr,dc), one of the 8. */
  dir: Coord;
}

/** A daily puzzle: a letter grid, targets, initial seed reveal, fog radius. */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-003 rowCount. */
  rows: number;
  /** FIELD-004 colCount. */
  cols: number;
  /** FIELD-005 gridLetters — `rows` strings of length `cols`. */
  grid: string[];
  targets: Target[];
  /** FIELD-009 seedCells — revealed at start. */
  seedCells: Coord[];
  /** FIELD-011 fogRevealRadius. */
  fogRevealRadius: number;
  /** FIELD-012 distanceMetric. */
  distanceMetric: DistanceMetric;
}

/** Persisted per-day attempt state (TERM-022 Game State). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-010 revealedMask — length rows*cols. */
  revealed: boolean[];
  /** FIELD-022 foundTargetIds. */
  foundTargetIds: string[];
  /** FIELD-023 selectionCount. */
  selectionCount: number;
  /** true once all targets found. */
  isComplete: boolean;
}

export type MatchType = "FOUND" | "BLOCKED_BY_FOG" | "NO_MATCH" | "ALREADY_FOUND";
