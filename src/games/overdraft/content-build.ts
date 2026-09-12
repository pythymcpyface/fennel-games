import type { Puzzle, ScoringMethod } from "./types.ts";
import { baseScore, borrowedLetters } from "./engine.ts";

// Build-time content generation + fairness gate for Overdraft. Pure + deterministic.
// The gate proves at least one dictionary word uses ONLY the letter set (0 borrow)
// and yields a positive net score, so borrowing is always optional.

/** Can `word` be formed using only the letter set (no borrow)? */
export function isInSetWord(word: string, letterSet: readonly string[]): boolean {
  return borrowedLetters(word, letterSet).length === 0;
}

/**
 * Fairness gate: exists a dictionary word using only the set with base score > 0.
 * (Net == base when borrow is 0.) Returns the proof word or null.
 */
export function findPositiveInSetWord(
  letterSet: readonly string[],
  puzzle: Puzzle,
  candidates: readonly string[],
): string | null {
  for (const w of candidates) {
    const up = w.toUpperCase();
    if (isInSetWord(up, letterSet) && baseScore(up, puzzle) > 0) return up;
  }
  return null;
}

/** Standard Scrabble-like letter values (deterministic, English). */
export const LETTER_POINTS: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

export function buildPuzzle(
  letterSet: string[],
  puzzleId: string,
  candidates: readonly string[],
  opts: { scoringMethod?: ScoringMethod; maxBorrow?: number; borrowPenalty?: number } = {},
): Puzzle | null {
  const puzzle: Puzzle = {
    puzzleId,
    letterSet: letterSet.map((c) => c.toUpperCase()),
    letterPoints: LETTER_POINTS,
    scoringMethod: opts.scoringMethod ?? "LETTER_SUM",
    maxBorrow: opts.maxBorrow ?? 2,
    borrowPenalty: opts.borrowPenalty ?? 4,
  };
  if (findPositiveInSetWord(puzzle.letterSet, puzzle, candidates) === null) return null;
  return puzzle;
}

export function assertPuzzleValid(p: Puzzle, candidates: readonly string[]): void {
  if (findPositiveInSetWord(p.letterSet, p, candidates) === null) {
    throw new Error(`overdraft ${p.puzzleId}: no positive-score in-set word (borrowing would be forced)`);
  }
}
