import type { AttemptState, DecodeResult, Puzzle } from "./types.ts";
import { PLACEHOLDER } from "./types.ts";

// Pure Cipher Diary engine. No storage, no clock. Substitution decoding +
// per-letter correctness. The mapping is cipher letter -> plaintext guess.

const LETTER = /^[A-Z]$/;

export function normalizeLetter(ch: string): string | null {
  const up = ch.trim().toUpperCase();
  return LETTER.test(up) ? up : null;
}

/** Distinct cipher letters (A-Z) that appear in the ciphertext (FIELD-011). */
export function usedCipherLetters(ciphertext: string): string[] {
  const set = new Set<string>();
  for (const ch of ciphertext.toUpperCase()) if (LETTER.test(ch)) set.add(ch);
  return [...set].sort();
}

/** REQ-003 — decode the ciphertext with the player's mapping; unmapped -> placeholder. */
export function decode(ciphertext: string, mapping: Record<string, string>): string {
  let out = "";
  for (const ch of ciphertext) {
    const up = ch.toUpperCase();
    if (LETTER.test(up)) out += mapping[up] ?? PLACEHOLDER;
    else out += ch; // preserve non-letters
  }
  return out;
}

/** REQ-004/005/006 — evaluate the current mapping against the true key. Pure. */
export function evaluate(puzzle: Puzzle, mapping: Record<string, string>): DecodeResult {
  const used = usedCipherLetters(puzzle.ciphertext);
  let correct = 0;
  for (const c of used) if (mapping[c] === puzzle.key[c]) correct++;
  return {
    preview: decode(puzzle.ciphertext, mapping),
    correct,
    total: used.length,
    solved: used.length > 0 && correct === used.length,
  };
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  // Start with the revealed fragment.
  const mapping: Record<string, string> = { ...puzzle.fragment };
  return { puzzleId: puzzle.puzzleId, dayId, mapping, isComplete: false };
}

export interface AssignOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "complete" | "invalid-letter" | "conflict" | "fragment-locked";
}

/**
 * REQ-007/008 — assign a plaintext guess to a cipher letter. Rejects invalid
 * letters, duplicate plaintext assignments (bijection, REQ-008 reject policy),
 * and edits to pre-revealed fragment letters. Passing null clears the mapping.
 */
export function assign(state: AttemptState, puzzle: Puzzle, cipherLetter: string, plainGuess: string | null): AssignOutcome {
  if (state.isComplete) return { state, accepted: false, reason: "complete" };
  const c = normalizeLetter(cipherLetter);
  if (c === null) return { state, accepted: false, reason: "invalid-letter" };
  // Fragment letters are locked (they are given/correct).
  if (puzzle.fragment[c] !== undefined) return { state, accepted: false, reason: "fragment-locked" };

  const mapping = { ...state.mapping };
  if (plainGuess === null || plainGuess === "") {
    delete mapping[c];
    return { state: { ...state, mapping }, accepted: true };
  }
  const p = normalizeLetter(plainGuess);
  if (p === null) return { state, accepted: false, reason: "invalid-letter" };
  // REQ-008 — reject if this plaintext letter is already assigned to another cipher letter.
  for (const [other, val] of Object.entries(mapping)) {
    if (other !== c && val === p) return { state, accepted: false, reason: "conflict" };
  }
  mapping[c] = p;
  const solved = evaluate(puzzle, mapping).solved;
  return { state: { ...state, mapping, isComplete: solved }, accepted: true };
}

/** Recompute completion (used after assignments). */
export function isSolved(state: AttemptState, puzzle: Puzzle): boolean {
  return evaluate(puzzle, state.mapping).solved;
}
