// Core domain types for Rhyme Chain. Pure data.

export type SlotStatus = "solved" | "in_progress" | "failed";
export type PuzzleOutcome = "in_progress" | "won" | "lost";
export type RhymeFeedback = "RHYMES" | "DOES_NOT_RHYME" | "UNKNOWN";
export type WordFeedback = "REAL_WORD" | "NOT_IN_DICTIONARY";

/** One ordered clue slot (TERM-014). */
export interface ClueSlot {
  clue: string;
  /** intended answer (lowercase). Bundled but never displayed. */
  answer: string;
}

/** A daily puzzle definition (TERM-012). */
export interface Puzzle {
  puzzleId: string;
  seedWord: string;
  slots: ClueSlot[];
}

/** Persisted per-day attempt state (TERM-017 / FIELD-024). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** accepted chain words, one per solved slot. */
  chainWords: string[];
  /** attempts used on the CURRENT slot. */
  attemptsUsedForSlot: number;
  /** attempts consumed per slot, recorded for the share artifact. */
  attemptsPerSlot: number[];
  outcome: PuzzleOutcome;
  hintUsedForSlot: boolean;
}

/** Feedback for an incorrect submission (TERM-027). */
export interface SubmissionFeedback {
  rhyme: RhymeFeedback;
  word: WordFeedback;
}

export const ATTEMPT_LIMIT = 4;

/** A rhyme dictionary: word -> rime key. Rhyme = equal rime key. */
export type RhymeDict = Record<string, string>;
