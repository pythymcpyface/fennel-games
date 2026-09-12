// Core domain types for Odd-One Gradient. Pure data.
//
// Odd-One Gradient: a set of SET_SIZE words is shown. Exactly one is the "odd one"
// — the word least compatible with the rest in GloVe semantic space (measured by
// the median rank of the other words when the universe is centred on it: a high
// median means the others are far, so it doesn't belong). The player taps the odd
// one; wrong taps get graded hot/cold feedback (how outlier-ish that pick was)
// and cost an attempt. Win = tap the true outlier within ATTEMPTS_TOTAL.

export type Status = "in_progress" | "won" | "lost";

/** Per-word coldness: higher = more outlier-ish. Precomputed at build time. */
export interface WordScore {
  word: string;
  /** median rank of the other set members (universe centred on this word). */
  coldness: number;
  /** coarse 0..HEAT_MAX bucket for spoiler-safe hot/cold feedback. */
  heat: number;
}

export interface Puzzle {
  puzzleId: string;
  /** the SET_SIZE words (sorted). */
  words: string[];
  /** the odd one (lowercase) — the answer. */
  odd: string;
  /** per-word coldness/heat, keyed by word. */
  scores: Record<string, WordScore>;
  /** short theme label for the cohesive majority (shown only after solving). */
  themeLabel: string;
}

export interface Guess {
  word: string;
  heat: number;
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
  error: "already_guessed" | "unknown_word" | "no_attempts_remaining" | null;
  guess?: Guess;
}

export const SET_SIZE = 6;
export const ATTEMPTS_TOTAL = 3;
/** Number of heat buckets (0 = clearly belongs … HEAT_MAX = clear outlier). */
export const HEAT_MAX = 4;
