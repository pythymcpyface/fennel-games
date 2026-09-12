import type { GuessValidity, RevealRow, RevealState } from "./types.ts";

// Pure reveal engine (TERM-021). Deterministic string operations only — identical
// across all platforms (NFR compatibility). No storage, no clock.

const MAX_INPUT = 32;

/** REQ-006 — normalize raw input: uppercase, strip non A–Z. */
export function normalizeGuess(input: string): string {
  return input
    .slice(0, MAX_INPUT)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/**
 * REQ-007/008/009 — validate a normalized guess against the bridge length and an
 * optional allowed-word set. Char validity is guaranteed by normalize, but we still
 * classify empty/short/long and dataset membership.
 */
export function validateGuess(
  guess: string,
  bridgeLength: number,
  allowedWords?: ReadonlySet<string>,
): GuessValidity {
  if (!/^[A-Z]+$/.test(guess)) return "INVALID_CHARS";
  if (guess.length !== bridgeLength) return "INVALID_LENGTH";
  if (allowedWords && !allowedWords.has(guess)) return "NOT_IN_DATASET";
  return "VALID";
}

/**
 * REQ-010 — Wordle-style two-pass letter reveal with correct duplicate-letter
 * handling. Pass 1 marks EXACT and decrements a letter-count pool; pass 2 marks
 * PRESENT only while the pool still has that letter, else ABSENT. Deterministic.
 */
export function computeReveal(guess: string, bridge: string): RevealRow {
  const n = bridge.length;
  const row: RevealState[] = new Array(n).fill("ABSENT");
  const pool = new Map<string, number>();
  for (const ch of bridge) pool.set(ch, (pool.get(ch) ?? 0) + 1);

  // Pass 1 — exact matches consume from the pool.
  for (let i = 0; i < n; i++) {
    if (guess[i] === bridge[i]) {
      row[i] = "EXACT";
      pool.set(guess[i], pool.get(guess[i])! - 1);
    }
  }
  // Pass 2 — present-but-misplaced, limited by remaining pool counts.
  for (let i = 0; i < n; i++) {
    if (row[i] === "EXACT") continue;
    const ch = guess[i];
    const remaining = pool.get(ch) ?? 0;
    if (remaining > 0) {
      row[i] = "PRESENT";
      pool.set(ch, remaining - 1);
    }
  }
  return row;
}

/** Is this guess the winning bridge word? */
export function isWinningGuess(guess: string, bridge: string): boolean {
  return guess === bridge;
}
