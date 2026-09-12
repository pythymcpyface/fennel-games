import type { Puzzle } from "./types.ts";
import { scoreOne } from "./engine.ts";
import { WORD_LEN } from "./types.ts";

// Build-time content generation + fairness gate for Mirrorle. Pure + deterministic.
// The daily puzzle is a pair of distinct 5-letter answer words. The gate ensures the
// pair is FAIR for aggregated (summed) feedback.

export interface GateConfig {
  /** minimum letter-difference between the two secrets so the sum is informative. */
  minDistinctLetters: number; // FIELD (fairness)
  /** reject pairs sharing too many positions (degenerate: sum looks like one word). */
  maxSharedPositions: number;
}

export const DEFAULT_GATE: GateConfig = { minDistinctLetters: 3, maxSharedPositions: 2 };

/** Count positions where two equal-length words share the same letter. */
export function sharedPositions(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < WORD_LEN; i++) if (a[i] === b[i]) n++;
  return n;
}

/** Count distinct letters appearing in one word but not the other (symmetric diff size). */
export function distinctLetters(a: string, b: string): number {
  const sa = new Set(a.split(""));
  const sb = new Set(b.split(""));
  let n = 0;
  for (const c of sa) if (!sb.has(c)) n++;
  for (const c of sb) if (!sa.has(c)) n++;
  return n;
}

/**
 * Fairness gate: a pair (A,B) is shippable when
 *  - A != B, both 5 letters, both in the answer list,
 *  - they differ by at least `minDistinctLetters` (so summed feedback discriminates),
 *  - they don't share more than `maxSharedPositions` positions (avoids a degenerate
 *    "looks like a single word" sum),
 *  - a self-guess of A yields exactly WORD_LEN green against A (sanity of scoring).
 */
export function isFairPair(a: string, b: string, cfg: GateConfig = DEFAULT_GATE): boolean {
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  if (A === B) return false;
  if (!/^[A-Z]{5}$/.test(A) || !/^[A-Z]{5}$/.test(B)) return false;
  if (distinctLetters(A, B) < cfg.minDistinctLetters) return false;
  if (sharedPositions(A, B) > cfg.maxSharedPositions) return false;
  if (scoreOne(A, A).green !== WORD_LEN) return false;
  if (scoreOne(B, B).green !== WORD_LEN) return false;
  return true;
}

/**
 * Build a validated puzzle set from curated candidate pairs, applying the gate and
 * requiring both secrets be present in the answer list.
 */
export function buildPuzzles(
  pairs: Array<[string, string]>,
  answers: ReadonlySet<string>,
  cfg: GateConfig = DEFAULT_GATE,
): Puzzle[] {
  const puzzles: Puzzle[] = [];
  const seen = new Set<string>();
  for (const [rawA, rawB] of pairs) {
    const a = rawA.toUpperCase();
    const b = rawB.toUpperCase();
    if (!answers.has(a) || !answers.has(b)) continue;
    if (!isFairPair(a, b, cfg)) continue;
    // Canonical, order-independent key so (A,B) and (B,A) don't both ship.
    const key = [a, b].sort().join("-");
    if (seen.has(key)) continue;
    seen.add(key);
    puzzles.push({ puzzleId: "", secretA: a, secretB: b });
  }
  puzzles.sort((p, q) => (p.secretA + p.secretB < q.secretA + q.secretB ? -1 : 1));
  return puzzles.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

/** Gate assertion: every emitted puzzle passes the fairness check. */
export function assertPuzzlesValid(puzzles: Puzzle[], answers: ReadonlySet<string>): void {
  for (const p of puzzles) {
    if (!answers.has(p.secretA) || !answers.has(p.secretB)) {
      throw new Error(`secret not in answer list for ${p.puzzleId}`);
    }
    if (!isFairPair(p.secretA, p.secretB)) {
      throw new Error(`unfair pair for ${p.puzzleId}: ${p.secretA}/${p.secretB}`);
    }
  }
}
