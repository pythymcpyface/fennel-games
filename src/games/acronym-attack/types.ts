// Core domain types for Acronym Attack. Pure data.
//
// Mechanic: given a fake ACRONYM (e.g. MOON) and a THEME, the player types one
// word per letter such that word[i] starts with acronym[i] and each word is a real
// dictionary word. There is no single "answer" — validity is objective (initials +
// dictionary), and a hidden "elegance" score rewards longer/less-common words. Win =
// a fully valid expansion. Deterministic scoring; no editorial answer key needed.

export type Status = "in_progress" | "won";

export interface Puzzle {
  puzzleId: string;
  acronym: string; // e.g. "MOON"
  theme: string; // display label
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  words: string[]; // one per acronym letter; "" if unfilled
  status: Status;
  submitCount: number;
}

export interface ValidationResult {
  valid: boolean;
  perLetterOk: boolean[];
  allDictionary: boolean;
  score: number; // elegance score (sum of word lengths), 0 if invalid
}
