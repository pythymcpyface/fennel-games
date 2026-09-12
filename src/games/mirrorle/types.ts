// Core domain types for Mirrorle. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-001 Mirrorle; TERM-003/004 Secret Word/Pair; TERM-008 Aggregated Feedback.

/** A daily puzzle: the two hidden 5-letter secret words (TERM-004 Secret Pair). */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-003 secretWordA — 5 uppercase letters, in the answer list. */
  secretA: string;
  /** FIELD-004 secretWordB — 5 uppercase letters, in the answer list, != secretA. */
  secretB: string;
}

/** FIELD-009 feedbackRow — aggregated counts for one guess (TERM-008). */
export interface FeedbackRow {
  /** FIELD-005 the guess itself (needed to render the player's own board). */
  guess: string;
  /** FIELD-007 greenCount — summed correct-position matches across A and B (0..10). */
  green: number;
  /** FIELD-008 yellowCount — summed present-wrong-position across A and B (0..10). */
  yellow: number;
}

/** FIELD-014 gameState + FIELD-011/012 lists. Persisted per-day (TERM-014). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-011 guessList + FIELD-012 feedbackList, kept aligned as rows. */
  rows: FeedbackRow[];
  isSolved: boolean;
  isFailed: boolean;
}

/** FIELD-010 maxGuesses (TERM-007 Guess Budget). */
export const GUESS_BUDGET = 9;
/** Two 5-letter secrets → 10 possible green positions total. */
export const WORD_LEN = 5;
export const MAX_GREEN = 2 * WORD_LEN;
