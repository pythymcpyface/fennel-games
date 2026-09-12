// Core domain types for Borrowed (loanword -> source language matching). Pure data.

export type Status = "in_progress" | "solved" | "failed";

/** A daily puzzle: 5 words, each with a correct source-language label, plus the
 *  pool of language options shown to the player. */
export interface Puzzle {
  puzzleId: string;
  words: string[]; // 5 loanwords
  answers: string[]; // correct language per word (parallel)
  options: string[]; // language choices (superset incl. all answers)
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** chosen option per word ("" = unassigned). */
  choices: string[];
  attemptsUsed: number;
  status: Status;
  /** locked-correct flags (set once a word is confirmed correct). */
  locked: boolean[];
  history: number[]; // correct count per submit
}

export const ATTEMPT_LIMIT = 4;
export const ITEM_COUNT = 5;
