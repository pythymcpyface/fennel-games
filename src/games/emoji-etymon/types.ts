// Core domain types for Emoji Etymon. Pure data.
// Mechanic: an emoji rebus encodes a word (🐝+🍃 = BELIEF). Player guesses the word;
// Wordle-style letter feedback on the fixed-length answer. 6 guesses.

export type RevealState = "EXACT" | "PRESENT" | "ABSENT";
export type Status = "in_progress" | "won" | "lost";

export interface Puzzle {
  puzzleId: string;
  emoji: string; // the rebus, e.g. "🐝🍃"
  answer: string; // uppercase
  hintText: string; // the "sounds like" breakdown, revealed by hint
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  rows: RevealState[][];
  guesses: string[];
  status: Status;
  hintUsed: boolean;
}

export const MAX_GUESSES = 6;
