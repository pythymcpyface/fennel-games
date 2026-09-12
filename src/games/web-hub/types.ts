// Core domain types for Web Hub. Pure data.
//
// Web Hub: a board of BOARD_SIZE same-length words. Exactly one word — the "hub" —
// is a one-letter change away from more of the other board words than any other
// word is. The player taps the most-connected word (highest within-board degree
// in the edit-distance-1 graph). This is a single-node degree task, distinct from
// Edit Clusters' densest-subset task. Win = tap the unique hub within ATTEMPTS.

export type Status = "in_progress" | "won" | "lost";

export interface Puzzle {
  puzzleId: string;
  /** the board words (sorted, all same length). */
  board: string[];
  /** the unique highest-degree word — the answer. */
  hub: string;
  /** within-board degree of each word (one-letter-change neighbours on the board). */
  degrees: Record<string, number>;
  /** board-restricted adjacency: word -> board neighbours (sorted). */
  adjacency: Record<string, string[]>;
}

export interface Guess {
  word: string;
  degree: number;
  correct: boolean;
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  guesses: Guess[];
  attemptsRemaining: number;
  status: Status;
}

export interface SubmissionResult {
  state: AttemptState;
  correct: boolean;
  error: "unknown_word" | "already_guessed" | "no_attempts_remaining" | null;
  guess?: Guess;
}

export const BOARD_SIZE = 8;
export const ATTEMPTS_TOTAL = 3;
