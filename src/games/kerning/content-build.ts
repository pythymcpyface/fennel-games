import type { Puzzle } from "./types.ts";
import { phraseToMask, segmentToTokens } from "./engine.ts";

// Build-time content generation + gate. Pure.

export interface CandidatePair {
  readingA: string; // shown phrase
  readingB: string; // target phrase (same letters)
}

/** Enumerate every dictionary-word segmentation of a letter run (DP, capped). */
export function enumerateSegmentations(letterRun: string, dictionary: ReadonlySet<string>, cap = 64): string[][] {
  const n = letterRun.length;
  const memo = new Map<number, string[][]>();
  const solve = (i: number): string[][] => {
    if (i === n) return [[]];
    if (memo.has(i)) return memo.get(i)!;
    const out: string[][] = [];
    for (let j = i + 1; j <= n && out.length < cap; j++) {
      const w = letterRun.slice(i, j);
      if (dictionary.has(w)) for (const rest of solve(j)) { out.push([w, ...rest]); if (out.length >= cap) break; }
    }
    memo.set(i, out);
    return out;
  };
  return solve(0);
}

/**
 * A pair is valid iff: both readings strip to the same letter run, both tokenize to
 * dictionary words, and they differ. (We do not require the run to have exactly two
 * segmentations — English produces many spurious short-word splits; the target is a
 * specific curated reading and the win check is exact-match, so ambiguity does not
 * make the puzzle unfair, only the shown reading A must be a genuine alternative.)
 */
export function isValidPair(cand: CandidatePair, dictionary: ReadonlySet<string>): boolean {
  const a = phraseToMask(cand.readingA);
  const b = phraseToMask(cand.readingB);
  if (a.letterRun !== b.letterRun) return false;
  const tokA = segmentToTokens(a.letterRun, a.mask);
  const tokB = segmentToTokens(b.letterRun, b.mask);
  if (tokA.length < 2 || tokB.length < 2) return false; // both must be re-spaced
  if (!tokA.every((t) => dictionary.has(t))) return false;
  if (!tokB.every((t) => dictionary.has(t))) return false;
  if (a.mask.every((v, i) => v === b.mask[i])) return false; // A and B must differ
  return true;
}

export function buildPuzzles(candidates: CandidatePair[], dictionary: ReadonlySet<string>): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isValidPair(c, dictionary)) continue;
    const a = phraseToMask(c.readingA);
    const b = phraseToMask(c.readingB);
    out.push({ puzzleId: "", letterRun: a.letterRun, shownMask: a.mask, targetMask: b.mask });
  }
  out.sort((x, y) => (x.letterRun < y.letterRun ? -1 : x.letterRun > y.letterRun ? 1 : 0));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    if (p.shownMask.length !== p.letterRun.length - 1) throw new Error(`bad mask len ${p.puzzleId}`);
    if (p.shownMask.every((v, i) => v === p.targetMask[i])) throw new Error(`A==B ${p.puzzleId}`);
  }
}
