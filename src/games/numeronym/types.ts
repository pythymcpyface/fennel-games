// Core domain types for Numeronym. Pure data.

export type Status = "in_progress" | "won" | "lost";
export type ErrorCode = "empty_guess" | "not_in_dictionary" | "encoding_mismatch" | "wrong_answer" | "no_attempts_remaining" | "already_solved" | null;

export interface Puzzle {
  puzzleId: string;
  clues: string[]; // numeronym clues, e.g. "GR8"
  answers: string[]; // uppercase expansions, e.g. "GREAT"
  themeLabel: string;
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  solved: boolean[];
  attemptsRemaining: number;
  status: Status;
  revealedLengths: number[]; // 0 = not revealed
}

export interface SubmissionResult {
  state: AttemptState;
  correct: boolean;
  error: ErrorCode;
  isDictionaryWord?: boolean;
  encodingMatches?: boolean;
}

export const ATTEMPTS_TOTAL = 6;
export const WORDS_COUNT = 5;

/** Substitution map: token -> possible sound-alike expansions. */
export type SubstitutionMap = Record<string, string[]>;
export const DEFAULT_SUBSTITUTIONS: SubstitutionMap = {
  "8": ["ATE", "EIGHT"],
  "4": ["FOR", "FOUR"],
  "2": ["TO", "TOO", "TWO"],
  "1": ["ONE"],
  "0": ["OH"],
  "9": ["NINE"],
};
