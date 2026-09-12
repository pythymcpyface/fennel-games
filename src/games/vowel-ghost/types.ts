// Core domain types for Vowel Ghost. Pure data.

export type Status = "in_progress" | "won" | "lost";

/** A daily puzzle: 5 themed words + theme label (revealed on win). */
export interface Puzzle {
  puzzleId: string;
  words: string[]; // uppercase answers, length 5
  skeletons: string[]; // vowel-stripped, parallel to words
  themeLabel: string;
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  solved: boolean[]; // per word
  attemptsUsed: number;
  status: Status;
  hintUsed: boolean[]; // per word
}

export interface SubmissionFeedback {
  isDictionaryWord: boolean;
  isSkeletonMatch: boolean;
}

export const ATTEMPTS_TOTAL = 8;
export const WORDS_COUNT = 5;
export const VOWELS = new Set(["A", "E", "I", "O", "U"]);
