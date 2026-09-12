// Core domain types for Tollgate. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-001 Tollgate; TERM-010 Move Cost; TERM-011 Total Cost; TERM-014 Par.

/**
 * A daily puzzle: transform START into TARGET by one-letter moves; each move costs
 * the toll of the INTRODUCED letter. Objective: minimise total cost (not steps).
 * Ships the precomputed par (Dijkstra min cost) so the client can score vs par.
 */
export interface Puzzle {
  puzzleId: string;
  start: string;
  target: string;
  /** FIELD-008 toll per letter A..Z (index 0=A). */
  tolls: number[];
  /** FIELD-010 par cost — precomputed minimum total cost. */
  par: number;
}

/** Persisted per-day attempt state (TERM-012 path). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-015 pathWords — starts at [start]; last element is current word. */
  path: string[];
  /** FIELD-017 totalCost accumulated. */
  totalCost: number;
  isSolved: boolean;
}

export const A_CODE = 65;
