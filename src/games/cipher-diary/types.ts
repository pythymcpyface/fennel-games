// Core domain types for Cipher Diary — a daily decryption game. A short diary
// entry is encrypted with a monoalphabetic substitution cipher. A small key
// fragment (cipher->plain mappings "carried over from yesterday") is pre-revealed;
// the player deduces the rest and reconstructs the plaintext.
//
// Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-005 Ciphertext; TERM-008 Substitution Key; TERM-009 Key Fragment; TERM-013 Solved.

export const PLACEHOLDER = "·";

/** A daily puzzle. `key` is cipher->plain (the true solution mapping). */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-003 ciphertext (letters uppercased; non-letters preserved). */
  ciphertext: string;
  /** FIELD-005 fullKey — cipher letter -> plaintext letter (bijection over used letters). */
  key: Record<string, string>;
  /** FIELD-006 keyFragment — subset of `key` pre-revealed at start (cipher->plain). */
  fragment: Record<string, string>;
}

/** Persisted per-day attempt state (client state). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-007 playerMapping — cipher letter -> guessed plaintext letter (or absent). */
  mapping: Record<string, string>;
  /** true once fully decoded. */
  isComplete: boolean;
}

/** FIELD-008..012 engine outputs for a mapping. */
export interface DecodeResult {
  /** FIELD-008 decodedPreview. */
  preview: string;
  /** FIELD-010 correctLetterCount. */
  correct: number;
  /** FIELD-011 totalCipherLettersUsed. */
  total: number;
  /** FIELD-012 solved. */
  solved: boolean;
}

/** FIELD-014 share progress band. */
export type ProgressBand = "B0" | "B1" | "B2" | "B3" | "B4" | "B5";
