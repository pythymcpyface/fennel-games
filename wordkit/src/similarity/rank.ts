import type { RankTable, SimilarityProvider } from "../types.ts";

// Per-target rank table builder. Generalised from ladderless/src/content/build.ts.
// KEY DIFFERENCE: the ranking universe is passed in explicitly (a bounded
// candidate pool), NOT the whole validation dictionary — so rank-table storage
// stays O(targets x universe), never O(targets x accept-list).

/** Number of coarse tiers for share/feedback bucketing (spoiler-safe). */
export const TIER_COUNT = 10;

/**
 * Build a per-target rank table over `universe`. Rank 1 = target, ascending by
 * descending similarity. Ties broken lexicographically for determinism.
 * Out-of-vocabulary words (provider.cosine returns -Infinity) sort to the end
 * deterministically by word.
 */
export function buildRankTable(
  targetWord: string,
  universe: readonly string[],
  provider: SimilarityProvider,
  tierCount: number = TIER_COUNT,
): RankTable {
  const others = universe.filter((w) => w !== targetWord);
  const scored = others
    .map((w) => ({ w, s: provider.cosine(targetWord, w) }))
    .sort((a, b) => b.s - a.s || (a.w < b.w ? -1 : a.w > b.w ? 1 : 0));

  const ranks: Record<string, number> = { [targetWord]: 1 };
  scored.forEach((entry, i) => {
    ranks[entry.w] = i + 2; // target is 1, rest start at 2
  });

  const vocabSize = targetWord in ranks ? others.length + 1 : others.length;
  const tierCutoffs: number[] = [];
  for (let t = 1; t < tierCount; t++) {
    tierCutoffs.push(Math.round((vocabSize * t) / tierCount) + 1);
  }
  return { targetWord, vocabSize, ranks, tierCutoffs };
}

/**
 * Coverage gate: every universe word has a unique rank in 1..vocabSize and the
 * target is rank 1. Throws on any violation (fails the build).
 */
export function assertRankTableValid(table: RankTable, universe: readonly string[]): void {
  if (table.ranks[table.targetWord] !== 1) {
    throw new Error(`target "${table.targetWord}" is not rank 1`);
  }
  const uniq = new Set(universe);
  uniq.add(table.targetWord);
  if (Object.keys(table.ranks).length !== uniq.size) {
    throw new Error(`rank table coverage mismatch for "${table.targetWord}"`);
  }
  const seen = new Set<number>();
  for (const w of uniq) {
    const r = table.ranks[w];
    if (r === undefined) throw new Error(`missing rank for "${w}"`);
    if (r < 1 || r > uniq.size) throw new Error(`rank ${r} out of range for "${w}"`);
    if (seen.has(r)) throw new Error(`duplicate rank ${r}`);
    seen.add(r);
  }
}
