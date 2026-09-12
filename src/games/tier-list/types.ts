// Core domain types for Tier List. Pure data.
//
// Tier List: RANK_SIZE words drawn from distinct, well-separated SCOWL frequency
// tiers are shown shuffled. The player orders them from MOST COMMON to RAREST.
// Because each word sits in a different frequency band (ground-truth data — not an
// embedding), there is exactly one correct order. One submission per attempt
// returns only how many words are in their correct rank position (Connections-
// style). Win = perfect order within ATTEMPTS_TOTAL.

export type Status = "in_progress" | "won" | "lost";

export interface Puzzle {
  puzzleId: string;
  /** the shuffled board words (sorted for storage). */
  words: string[];
  /** the correct order, most-common first (index 0) to rarest (last). */
  order: string[];
  /** each word's SCOWL frequency tier (for the post-solve reveal). */
  tiers: Record<string, number>;
}

export interface Attempt {
  /** player's ordering of the words, most-common first. */
  ordering: string[];
  /** number of words in their correct position. */
  correctPositions: number;
  solved: boolean;
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  attempts: Attempt[];
  attemptsRemaining: number;
  status: Status;
}

export interface SubmissionResult {
  state: AttemptState;
  correct: boolean;
  error: "wrong_length" | "unknown_word" | "no_attempts_remaining" | null;
  attempt?: Attempt;
}

export const RANK_SIZE = 5;
export const ATTEMPTS_TOTAL = 4;
