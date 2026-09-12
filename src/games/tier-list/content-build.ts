import type { Puzzle } from "./types.ts";
import { RANK_SIZE } from "./types.ts";

// Build-time content generation + fairness gate. Pure. The build tool supplies
// RANK_SIZE words each with a SCOWL frequency tier; this module derives the unique
// most-common -> rarest order and validates the tiers are distinct and spread so
// every step is an unambiguous familiarity jump.

export interface CandidateRank {
  words: string[]; // RANK_SIZE words
  tiers: Record<string, number>; // word -> frequency tier (lower = commoner)
}

/** Correct order: ascending tier (commonest first). Ties broken lexically. */
export function deriveOrder(cand: CandidateRank): string[] {
  return [...cand.words].sort((a, b) => {
    const ta = cand.tiers[a];
    const tb = cand.tiers[b];
    return ta - tb || (a < b ? -1 : a > b ? 1 : 0);
  });
}

/**
 * A rank set is FAIR iff:
 *  - it has exactly RANK_SIZE distinct words with known tiers;
 *  - all tiers are DISTINCT (no two words share a tier — otherwise their relative
 *    order is a coin-flip);
 *  - adjacent tiers in the sorted order differ by at least `minTierGap`, so each
 *    familiarity step is a clear jump rather than a hair-splitting call.
 */
export function isFairRank(cand: CandidateRank, minTierGap = 10): boolean {
  if (new Set(cand.words).size !== RANK_SIZE) return false;
  if (!cand.words.every((w) => typeof cand.tiers[w] === "number")) return false;
  const sortedTiers = cand.words.map((w) => cand.tiers[w]).sort((a, b) => a - b);
  if (new Set(sortedTiers).size !== RANK_SIZE) return false;
  for (let i = 1; i < sortedTiers.length; i++) {
    if (sortedTiers[i] - sortedTiers[i - 1] < minTierGap) return false;
  }
  return true;
}

export function buildPuzzles(candidates: CandidateRank[], minTierGap = 10): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isFairRank(c, minTierGap)) continue;
    out.push({
      puzzleId: "",
      words: [...c.words].sort(),
      order: deriveOrder(c),
      tiers: c.tiers,
    });
  }
  out.sort((a, b) => (a.words.join() < b.words.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[], minTierGap = 10): void {
  for (const p of puzzles) {
    const cand: CandidateRank = { words: p.words, tiers: p.tiers };
    if (deriveOrder(cand).join() !== p.order.join()) throw new Error(`order mismatch ${p.puzzleId}`);
    if (!isFairRank(cand, minTierGap)) throw new Error(`unfair rank ${p.puzzleId}`);
  }
}
