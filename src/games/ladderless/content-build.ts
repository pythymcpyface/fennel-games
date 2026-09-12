import type { RankTable, Puzzle } from "./types.ts";

// Build-time content generation (JOURNEY-007, TERM-032). Pure, deterministic.
// Given a curated vocabulary and a similarity function, produce per-target rank
// tables (Option A) with full dictionary coverage (RISK-005) and tier cutoffs.
//
// The similarity source is injected so the generator stays pure and testable:
// in production it is cosine over a bundled embedding; in tests it is a stub.

export type SimilarityFn = (a: string, b: string) => number;

/** Number of tiers used for share/feedback bucketing (coarse => spoiler-safe). */
export const TIER_COUNT = 10;

/**
 * Build a per-target rank table: rank 1 = target, ascending by descending
 * similarity. Ties broken lexicographically so the ranking is deterministic.
 */
export function buildRankTable(
  targetWord: string,
  vocabulary: readonly string[],
  similarity: SimilarityFn,
): RankTable {
  const others = vocabulary.filter((w) => w !== targetWord);
  const scored = others
    .map((w) => ({ w, s: similarity(targetWord, w) }))
    .sort((a, b) => (b.s - a.s) || (a.w < b.w ? -1 : a.w > b.w ? 1 : 0));

  const ranks: Record<string, number> = { [targetWord]: 1 };
  scored.forEach((entry, i) => {
    ranks[entry.w] = i + 2; // target is 1, rest start at 2
  });

  const vocabSize = vocabulary.length;
  // Evenly split the rank space into TIER_COUNT ascending cutoffs.
  const tierCutoffs: number[] = [];
  for (let t = 1; t < TIER_COUNT; t++) {
    tierCutoffs.push(Math.round((vocabSize * t) / TIER_COUNT) + 1);
  }
  return { targetWord, vocabSize, ranks, tierCutoffs };
}

/**
 * Solvability / coverage gate (TERM-033, RISK-005): every vocabulary word must
 * have a rank, ranks must be the exact set 1..vocabSize, and the target must be 1.
 * Throws with a descriptive message on any violation (fails the build).
 */
export function assertRankTableValid(table: RankTable, vocabulary: readonly string[]): void {
  if (table.ranks[table.targetWord] !== 1) {
    throw new Error(`target "${table.targetWord}" is not rank 1`);
  }
  if (Object.keys(table.ranks).length !== vocabulary.length) {
    throw new Error(`rank table coverage mismatch for "${table.targetWord}"`);
  }
  const seen = new Set<number>();
  for (const w of vocabulary) {
    const r = table.ranks[w];
    if (r === undefined) throw new Error(`missing rank for "${w}"`);
    if (r < 1 || r > vocabulary.length) throw new Error(`rank ${r} out of range for "${w}"`);
    if (seen.has(r)) throw new Error(`duplicate rank ${r}`);
    seen.add(r);
  }
}

/** Compute par: the rank tier of the start word + a small constant floor. */
export function computePar(startWord: string, table: RankTable): number {
  const startRank = table.ranks[startWord];
  if (startRank === undefined) throw new Error(`start "${startWord}" not in table`);
  // Par scales with how far the start sits from the target; min 3.
  return Math.max(3, Math.ceil(Math.log2(startRank + 1)) + 2);
}

/** Assemble a Puzzle definition from a start/target pair and its table. */
export function buildPuzzle(
  puzzleId: string,
  startWord: string,
  targetWord: string,
  table: RankTable,
): Puzzle {
  return { puzzleId, startWord, targetWord, parGuesses: computePar(startWord, table) };
}
