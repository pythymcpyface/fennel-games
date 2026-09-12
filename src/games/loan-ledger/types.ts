// Core domain types for Loan Ledger (deduce meaning from morphemes). Pure data.

export type Status = "in_progress" | "solved" | "failed";

export interface MorphemeWord {
  word: string; // e.g. HYDROPHOBIA
  morphemes: { part: string; gloss: string }[]; // [{HYDRO, water}, {PHOBIA, fear}]
  answer: string; // correct meaning, e.g. "fear of water"
}

export interface Puzzle {
  puzzleId: string;
  items: MorphemeWord[]; // 5
  options: string[]; // meaning choices (superset incl. all answers)
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  choices: string[];
  attemptsUsed: number;
  status: Status;
  locked: boolean[];
  history: number[];
}

export const ATTEMPT_LIMIT = 4;
export const ITEM_COUNT = 5;
