import type { GuessRecord } from "./types.ts";

// REQ-006/007 — pure guess validation: dictionary membership + duplicate detection.
// Assumes the caller has already normalized the word (engine.normalizeGuess).

export type ValidationReason = "not_in_dictionary" | "duplicate";

export interface ValidationResult {
  ok: boolean;
  reason?: ValidationReason;
}

export function validateGuess(
  guessWord: string,
  dictionary: ReadonlySet<string>,
  guessHistory: readonly GuessRecord[],
): ValidationResult {
  if (!dictionary.has(guessWord)) {
    return { ok: false, reason: "not_in_dictionary" };
  }
  if (guessHistory.some((g) => g.guessWord === guessWord)) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true };
}
