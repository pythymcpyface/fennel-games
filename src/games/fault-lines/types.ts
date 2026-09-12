// Core domain types for Fault Lines — a crossword-audit game. The grid is shown
// ALREADY FILLED IN, but some entries are wrong ("faults"): plausible real words
// that don't match their clue. The player flags which entries are faulty.
//
// Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-007 Entry; TERM-012 Fault; TERM-013 isFaulty; TERM-018 Score.

export type Direction = "ACROSS" | "DOWN";

/**
 * A crossword entry. `displayedAnswer` is what's shown in the filled grid (may be
 * wrong); `isFaulty` is the hidden ground truth. FIELD-008..016.
 */
export interface Entry {
  /** FIELD-008 EntryId — unique within a puzzle (e.g. "A-1", "D-3"). */
  entryId: string;
  /** FIELD-009 EntryNumber. */
  number: number;
  /** FIELD-010 Direction. */
  direction: Direction;
  /** FIELD-011 ClueText. */
  clue: string;
  /** FIELD-012 DisplayedAnswer — shown in the grid; correct or faulty. */
  displayedAnswer: string;
  /** FIELD-016 EntryCellIndexes — flat grid indexes this entry occupies. */
  cells: number[];
  /** FIELD-014 isFaulty — hidden ground truth (never rendered in UI). */
  isFaulty: boolean;
}

/** A daily puzzle: grid geometry + the filled entries. */
export interface Puzzle {
  /** FIELD-002 PuzzleId. */
  puzzleId: string;
  /** FIELD-004 rowCount. */
  rows: number;
  /** FIELD-005 colCount. */
  cols: number;
  /** FIELD-006 gridBlocks — length rows*cols; true = block cell. */
  blocks: boolean[];
  /** FIELD-007 gridLetters — length rows*cols; displayed letters ("" for blocks). */
  letters: string[];
  entries: Entry[];
  /** FIELD-015 faultCount — number of faulty entries. */
  faultCount: number;
}

/** Persisted per-day attempt state (TERM-016 Submission / TERM-017 Lock). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-018 playerFlagged, indexed the same as puzzle.entries. */
  flags: boolean[];
  /** FIELD-019 hasSubmitted. */
  isComplete: boolean;
}

/** Result of scoring a submission. */
export interface AuditResult {
  /** FIELD-021 correctFlagCount — flagged AND faulty. */
  correctFlags: number;
  /** FIELD-022 falseAccusationCount — flagged AND not faulty. */
  falseAccusations: number;
  /** FIELD-023 score = correctFlags - falseAccusations. */
  score: number;
  /** FIELD-024 solved. */
  solved: boolean;
  /** FIELD-025 correctnessByEntry — flag matched ground truth. */
  correctnessByEntry: boolean[];
}
