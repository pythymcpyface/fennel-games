import type { Puzzle } from "./types.ts";
import { WORDS_COUNT } from "./types.ts";
import { stripVowels } from "./engine.ts";

// Build-time content generation + uniqueness/fairness gate (TERM-021). Pure.

export interface CandidateSet {
  words: string[]; // 5 themed answers
  themeLabel: string;
}

/**
 * REQ-025 (frequency-aware) — a skeleton is fair for its answer iff the answer is
 * among the TWO most-common words that strip to it. `rankBySkeleton` maps a skeleton
 * -> words ordered most-common-first (from wordkit frequency tiers). Allowing the top
 * two tolerates a single common rival while still guaranteeing the themed answer is an
 * obvious, high-frequency filling (the theme label disambiguates the intended one).
 */
export function isFairSet(
  cand: CandidateSet,
  dictionary: ReadonlySet<string>,
  rankBySkeleton: Record<string, string[]>,
): boolean {
  if (cand.words.length !== WORDS_COUNT) return false;
  const upper = cand.words.map((w) => w.toUpperCase());
  if (new Set(upper).size !== WORDS_COUNT) return false;
  if (!upper.every((w) => /^[A-Z]+$/.test(w) && dictionary.has(w))) return false;
  if (!cand.themeLabel.trim()) return false;
  for (const w of upper) {
    const sk = stripVowels(w);
    const ranked = rankBySkeleton[sk] ?? [];
    // The answer must be one of the two most-common fillings of this skeleton.
    if (!ranked.slice(0, 2).includes(w)) return false;
  }
  return true;
}

export function buildPuzzles(
  candidates: CandidateSet[],
  dictionary: ReadonlySet<string>,
  rankBySkeleton: Record<string, string[]>,
): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isFairSet(c, dictionary, rankBySkeleton)) continue;
    const words = c.words.map((w) => w.toUpperCase());
    out.push({ puzzleId: "", words, skeletons: words.map(stripVowels), themeLabel: c.themeLabel });
  }
  out.sort((a, b) => (a.words.join() < b.words.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[], dictionary: ReadonlySet<string>, rankBySkeleton: Record<string, string[]>): void {
  for (const p of puzzles) {
    if (!isFairSet({ words: p.words, themeLabel: p.themeLabel }, dictionary, rankBySkeleton)) {
      throw new Error(`unfair set ${p.puzzleId}`);
    }
  }
}
