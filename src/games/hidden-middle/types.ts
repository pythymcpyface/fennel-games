// Core domain types for Hidden Middle. Pure data.

export type PuzzleStatus = "in_progress" | "solved" | "failed";
export type GuessResultCode = "CORRECT" | "INCORRECT" | "DUPLICATE" | "EMPTY";

/** A daily puzzle (TERM-005). answerWord is bundled but never displayed. */
export interface Puzzle {
  puzzleId: string;
  carrierWord: string; // uppercase
  clue: string;
  answerWord: string; // uppercase; a contiguous substring of carrierWord
}

/** One recorded guess (FIELD-016 element). */
export interface GuessRecord {
  guess: string;
  isSubstring: boolean;
  isDictionaryWord: boolean;
  result: GuessResultCode;
}

/** Persisted per-day attempt state (FIELD-014..020). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  status: PuzzleStatus;
  incorrectAttemptsUsed: number;
  guessHistory: GuessRecord[];
  hintRevealed: boolean;
}

/** Feedback for an incorrect guess (TERM-012). */
export interface SubmissionFeedback {
  isSubstring: boolean;
  isDictionaryWord: boolean;
}

export const MAX_INCORRECT_ATTEMPTS = 6;
