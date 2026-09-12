// Core domain types for Ghost Group. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-006 Category; TERM-008 Ghost Category; TERM-011 Submission; TERM-014 Mistake Budget.

/** A solution category: 4 word indices + a label + whether it's the ghost. */
export interface Category {
  id: string;
  label: string;
  /** indices into the puzzle's `words` (exactly 4). */
  wordIdx: number[];
  isGhost: boolean;
}

/**
 * A daily puzzle: 16 words + 4 categories (3 given labels shown, 1 ghost). The
 * ghost's label is chosen from `ghostCandidates` after the words are solved.
 */
export interface Puzzle {
  puzzleId: string;
  words: string[]; // 16 unique uppercase words
  categories: Category[]; // exactly 4; exactly one isGhost
  /** multiple-choice options for the ghost label (includes the correct one). */
  ghostCandidates: string[];
}

export const MISTAKE_BUDGET = 4;
export const GROUP_SIZE = 4;
export const BOARD_SIZE = 16;

export type PlayState = "in_progress" | "won" | "lost";

/** Persisted per-day attempt state (TERM-027 session). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** category ids solved so far (by word membership). */
  solved: string[];
  mistakes: number;
  playState: PlayState;
  /** the ghost label the player picked (null until chosen). */
  ghostPick: string | null;
  ghostCorrect: boolean | null;
  /** per-submission outcome for the spoiler-safe share: true=correct group. */
  history: boolean[];
}
