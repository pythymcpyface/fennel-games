// Core domain types for Homophone Heist. Pure data.
// Mechanic: a phrase is shown as homophones (EYE SCREAM FOUR ...); the player types
// the intended word for each slot. Accept iff the guess is a known homophone of the
// shown token AND equals the intended answer.

export type Status = "in_progress" | "won" | "lost";

export interface Puzzle {
  puzzleId: string;
  shownTokens: string[]; // homophone tokens displayed
  answers: string[]; // intended words (parallel)
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  solved: boolean[];
  attemptsUsed: number;
  status: Status;
  history: number[]; // correct count per submit round (not used; per-slot game)
}

export interface SubmissionFeedback {
  isHomophone: boolean;
}

export const ATTEMPTS_TOTAL = 6;
