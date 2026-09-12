import type { Puzzle } from "./types.ts";
import { phraseToBreaks, segmentToTokens } from "./engine.ts";

// Build-time content generation + quality gate (TERM-028/029/030, JOURNEY-008).
// Pure + deterministic.

/** Enumerate every segmentation of a string into dictionary words (DP). */
export function enumerateSegmentations(
  puzzleString: string,
  dictionary: ReadonlySet<string>,
  cap = 64,
): string[][] {
  const n = puzzleString.length;
  // memo[i] = list of tokenizations of suffix starting at i
  const memo = new Map<number, string[][]>();
  const solve = (i: number): string[][] => {
    if (i === n) return [[]];
    if (memo.has(i)) return memo.get(i)!;
    const out: string[][] = [];
    for (let j = i + 1; j <= n && out.length < cap; j++) {
      const w = puzzleString.slice(i, j);
      if (dictionary.has(w)) {
        for (const rest of solve(j)) {
          out.push([w, ...rest]);
          if (out.length >= cap) break;
        }
      }
    }
    memo.set(i, out);
    return out;
  };
  return solve(0);
}

/** Score a tokenization via a bundled word-bigram log-frequency model. Higher = more plausible. */
export function scoreSegmentation(tokens: string[], bigram: Record<string, number>, unigram: Record<string, number>): number {
  let score = 0;
  for (let i = 0; i < tokens.length; i++) {
    score += unigram[tokens[i]] ?? 0;
    if (i > 0) score += bigram[`${tokens[i - 1]} ${tokens[i]}`] ?? 0;
  }
  // Slight penalty per token so trivial over-segmentation is not favored.
  return score - tokens.length * 0.01;
}

export interface GateModel {
  bigram: Record<string, number>;
  unigram: Record<string, number>;
  dominanceMargin: number; // FIELD-030
}

/**
 * TERM-030 — the intended segmentation must be the unique dominant reading: it must
 * score highest AND beat the runner-up by at least dominanceMargin. Rejects
 * ambiguous phrases (EDGE-007). Returns true if the phrase is fair to ship.
 */
export function isDominant(
  phrase: string,
  dictionary: ReadonlySet<string>,
  model: GateModel,
): boolean {
  const { puzzleString } = phraseToBreaks(phrase);
  const intendedTokens = phrase.trim().toUpperCase().split(/\s+/);
  // Every intended token must be a dictionary word.
  if (!intendedTokens.every((t) => dictionary.has(t))) return false;

  const segs = enumerateSegmentations(puzzleString, dictionary);
  if (segs.length === 0) return false;
  const scored = segs
    .map((s) => ({ s, score: scoreSegmentation(s, model.bigram, model.unigram) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (top.s.join(" ") !== intendedTokens.join(" ")) return false; // intended must win
  if (scored.length === 1) return true; // only one reading — unambiguous
  return top.score - scored[1].score >= model.dominanceMargin;
}

/** Build a validated puzzle set from curated phrases, applying the gate. */
export function buildPuzzles(
  phrases: string[],
  dictionary: ReadonlySet<string>,
  model: GateModel,
): Puzzle[] {
  const puzzles: Puzzle[] = [];
  const seen = new Set<string>();
  for (const phrase of phrases) {
    if (!isDominant(phrase, dictionary, model)) continue;
    const { puzzleString, intendedBreaks } = phraseToBreaks(phrase);
    if (seen.has(puzzleString)) continue;
    seen.add(puzzleString);
    puzzles.push({ puzzleId: "", puzzleString, intendedBreaks });
  }
  puzzles.sort((a, b) => (a.puzzleString < b.puzzleString ? -1 : 1));
  return puzzles.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

/** Gate assertion: every emitted puzzle's intended reading tokenizes to real words. */
export function assertPuzzlesValid(puzzles: Puzzle[], dictionary: ReadonlySet<string>): void {
  for (const p of puzzles) {
    const tokens = segmentToTokens(p.puzzleString, p.intendedBreaks);
    if (!tokens.every((t) => dictionary.has(t))) {
      throw new Error(`invalid tokens for ${p.puzzleId}: ${tokens.join("|")}`);
    }
  }
}
