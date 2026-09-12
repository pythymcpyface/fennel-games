// Core domain types for Clueback — a reverse crossword. The grid is already
// SOLVED (all answers shown); the CLUES are missing. For each answer entry the
// player picks the one real clue from three candidates (1 correct + 2 distractors).
//
// Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-005 Answer Entry; TERM-006 Correct Clue; TERM-007 Distractor Clue;
// TERM-008 Candidate Clue Set; TERM-010 Score.

/**
 * A single crossword answer with its candidate clues. FIELD-004..012.
 * `candidates` holds exactly 3 clue texts (already shuffled at build time); the
 * correct one lives at `correctIndex` (0..2). The answer itself is shown solved.
 */
export interface Entry {
  /** FIELD-004 EntryId — unique within a puzzle. */
  entryId: string;
  /** FIELD-005 AnswerText — the solved answer (shown to the player). */
  answer: string;
  /** FIELD-011 CandidateClues — exactly 3 distinct clue texts. */
  candidates: string[];
  /** FIELD-007/014 index into `candidates` of the correct clue (0..2). */
  correctIndex: number;
}

/** A daily puzzle: a solved grid represented as its ordered answer entries. */
export interface Puzzle {
  /** FIELD-002 PuzzleId. */
  puzzleId: string;
  entries: Entry[];
}

/** Per-entry UI/selection status (FIELD-015 EntryStatus). */
export type EntryStatus = "unanswered" | "answered_correct" | "answered_incorrect";

/** Persisted per-day attempt state (TERM-012 Session). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /**
   * FIELD-013 SelectedClueIndex per entry, indexed the same as puzzle.entries.
   * null = unanswered. Locked after first selection (ADR-003 / EDGE-003).
   */
  selections: (number | null)[];
  /** FIELD-021 IsPuzzleComplete — true once every entry has a selection. */
  isComplete: boolean;
}

/** Exactly three candidate clues per entry (TERM-008). */
export const CANDIDATES_PER_ENTRY = 3;
