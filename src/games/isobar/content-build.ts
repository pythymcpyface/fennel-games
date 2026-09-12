import type { Puzzle } from "./types.ts";
import { WORD_COUNT } from "./types.ts";

// Build-time content generation + fairness gate for Isobar. Pure + deterministic.
// Similarity injected (GloVe cosine in prod, stub in tests). No vectors ship.

export type SimilarityFn = (a: string, b: string) => number; // cosine in [-1,1]

/** Cosine distance in [0,2]; lower = closer in meaning. */
export function dist(sim: SimilarityFn, a: string, b: string): number {
  return 1 - sim(a, b);
}

/**
 * Quantise a distance into a ring band 0..ringCount-1 using ascending cutoffs.
 * cutoffs has length ringCount-1 (monotonic increasing distances).
 */
export function ringForDistance(d: number, cutoffs: number[]): number {
  for (let i = 0; i < cutoffs.length; i++) if (d < cutoffs[i]) return i;
  return cutoffs.length; // outermost
}

/**
 * Fairness gate: the 5 words must map to DISTINCT rings (a permutation-ish spread
 * across ringCount rings) so placement is decisive. Returns the correctRings if
 * fair, else null.
 */
export function computeRings(
  sim: SimilarityFn,
  center: string,
  words: string[],
  cutoffs: number[],
): number[] | null {
  if (words.length !== WORD_COUNT) return null;
  const rings = words.map((w) => ringForDistance(dist(sim, center, w), cutoffs));
  // All rings must be distinct (each word on its own ring) for decisiveness.
  if (new Set(rings).size !== WORD_COUNT) return null;
  return rings;
}

/** Assemble a validated puzzle from a fair (center, words) set. */
export function buildPuzzle(
  sim: SimilarityFn,
  center: string,
  words: string[],
  cutoffs: number[],
  puzzleId: string,
): Puzzle | null {
  const rings = computeRings(sim, center, words, cutoffs);
  if (rings === null) return null;
  return {
    puzzleId,
    ringCount: cutoffs.length + 1,
    words: words.map((w) => w.toUpperCase()),
    correctRings: rings,
  };
}

/** Gate assertion: 5 words, distinct rings in range. */
export function assertPuzzleValid(p: Puzzle): void {
  if (p.words.length !== WORD_COUNT) throw new Error(`isobar ${p.puzzleId}: need ${WORD_COUNT} words`);
  if (new Set(p.correctRings).size !== WORD_COUNT) throw new Error(`isobar ${p.puzzleId}: rings not distinct`);
  for (const r of p.correctRings) {
    if (r < 0 || r >= p.ringCount) throw new Error(`isobar ${p.puzzleId}: ring out of range`);
  }
}
