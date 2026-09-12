// Core domain types for Stress Test (mark the stressed syllable). Pure data.

export type Status = "in_progress" | "solved" | "failed";

export interface StressWord {
  word: string; // display, e.g. "RECORD"
  syllables: string[]; // e.g. ["RE","CORD"]
  stressedIndex: number; // correct stressed syllable index
  sense?: string; // optional disambiguating gloss for homographs
}

export interface Puzzle {
  puzzleId: string;
  items: StressWord[]; // 5
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  choices: number[]; // chosen syllable index per word (-1 = unset)
  attemptsUsed: number;
  status: Status;
  locked: boolean[];
  history: number[];
}

export const ATTEMPT_LIMIT = 4;
export const ITEM_COUNT = 5;
