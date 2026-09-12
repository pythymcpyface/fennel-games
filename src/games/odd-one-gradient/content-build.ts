import type { Puzzle, WordScore } from "./types.ts";
import { HEAT_MAX, SET_SIZE } from "./types.ts";

// Build-time content generation + fairness gate. Pure. The build tool supplies
// each word's coldness (median rank of the other set members, universe centred on
// that word); this module derives the odd one, buckets heat, and validates that
// the outlier is DECISIVE (a clear coldness margin over the runner-up).

export interface CandidateSet {
  words: string[]; // SET_SIZE words
  coldness: Record<string, number>; // word -> median rank of others (higher = colder)
  themeLabel: string;
}

/** The odd one is the word with the highest coldness. Ties broken lexically. */
export function pickOdd(cand: CandidateSet): string | null {
  let odd: string | null = null;
  let best = -Infinity;
  for (const w of [...cand.words].sort()) {
    const c = cand.coldness[w] ?? -Infinity;
    if (c > best) {
      best = c;
      odd = w;
    }
  }
  return odd;
}

/**
 * Bucket each word's coldness into 0..HEAT_MAX relative to the set's own range,
 * so feedback is meaningful within the puzzle: the cohesive majority reads cold
 * (low heat), the outlier reads hot (HEAT_MAX). Deterministic, integer-only.
 */
export function bucketHeat(cand: CandidateSet): Record<string, WordScore> {
  const vals = cand.words.map((w) => cand.coldness[w] ?? 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const scores: Record<string, WordScore> = {};
  for (const w of cand.words) {
    const c = cand.coldness[w] ?? 0;
    const heat = Math.round(((c - min) / span) * HEAT_MAX);
    scores[w] = { word: w, coldness: c, heat: Math.max(0, Math.min(HEAT_MAX, heat)) };
  }
  return scores;
}

/**
 * A set is FAIR iff:
 *  - it has exactly SET_SIZE distinct words + a theme label;
 *  - the outlier's coldness exceeds the runner-up's by at least `marginFactor`×
 *    the runner-up (a clear, decisive gap — no ambiguous second outlier);
 *  - the cohesive majority is tight (their max coldness is small vs the outlier).
 */
export function isFairSet(cand: CandidateSet, marginFactor = 2): boolean {
  if (new Set(cand.words).size !== SET_SIZE) return false;
  if (!cand.themeLabel.trim()) return false;
  const odd = pickOdd(cand);
  if (!odd) return false;
  const sorted = cand.words.map((w) => cand.coldness[w] ?? 0).sort((a, b) => b - a);
  const top = sorted[0];
  const second = sorted[1];
  if (top <= 0) return false;
  // decisive gap: outlier at least marginFactor× the tightest rival coldness.
  return top >= Math.max(second * marginFactor, second + 20);
}

export function buildPuzzles(candidates: CandidateSet[], marginFactor = 2): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isFairSet(c, marginFactor)) continue;
    const odd = pickOdd(c)!;
    out.push({
      puzzleId: "",
      words: [...c.words].sort(),
      odd,
      scores: bucketHeat(c),
      themeLabel: c.themeLabel,
    });
  }
  out.sort((a, b) => (a.words.join() < b.words.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    const coldness: Record<string, number> = {};
    for (const w of p.words) coldness[w] = p.scores[w]?.coldness ?? 0;
    const cand: CandidateSet = { words: p.words, coldness, themeLabel: p.themeLabel };
    if (pickOdd(cand) !== p.odd) throw new Error(`odd mismatch ${p.puzzleId}`);
    if (!isFairSet(cand)) throw new Error(`unfair set ${p.puzzleId}`);
  }
}
