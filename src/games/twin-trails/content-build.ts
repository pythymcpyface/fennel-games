import type { Puzzle, Side } from "./types.ts";
import { PER_SIDE, SIDE_TOTAL } from "./types.ts";

// Build-time content generation + fairness gate. Pure. The build tool supplies,
// for each candidate, the two pivot labels and each board word's rank to A and B
// over a shared universe. This module verifies each word is DECISIVELY on its
// gold side (a clear rank margin) and that both sides are balanced.

export interface CandidateWord {
  word: string;
  rankA: number; // rank to pivot A (smaller = closer)
  rankB: number; // rank to pivot B
  side: Side; // intended gold side
}
export interface CandidateTrail {
  labelA: string;
  labelB: string;
  words: CandidateWord[]; // SIDE_TOTAL words, PER_SIDE per side
}

/** Signed margin: positive => closer to A (rankA smaller), negative => closer to B. */
export function margin(w: CandidateWord): number {
  return w.rankB - w.rankA;
}

/**
 * A trail set is FAIR iff:
 *  - it has exactly SIDE_TOTAL words with PER_SIDE per side and distinct words;
 *  - every A-word has margin >= minMargin and every B-word has margin <= -minMargin
 *    (each word is decisively on its own trail — not a coin-flip);
 *  - both labels are present.
 */
export function isFairTrail(cand: CandidateTrail, minMargin = 30): boolean {
  if (!cand.labelA.trim() || !cand.labelB.trim()) return false;
  if (cand.words.length !== SIDE_TOTAL) return false;
  if (new Set(cand.words.map((w) => w.word)).size !== SIDE_TOTAL) return false;
  const aWords = cand.words.filter((w) => w.side === "A");
  const bWords = cand.words.filter((w) => w.side === "B");
  if (aWords.length !== PER_SIDE || bWords.length !== PER_SIDE) return false;
  for (const w of aWords) if (margin(w) < minMargin) return false;
  for (const w of bWords) if (margin(w) > -minMargin) return false;
  return true;
}

export function buildPuzzles(candidates: CandidateTrail[], minMargin = 30): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isFairTrail(c, minMargin)) continue;
    const words = c.words.map((w) => w.word).sort();
    const gold: Record<string, Side> = {};
    for (const w of c.words) gold[w.word] = w.side;
    out.push({ puzzleId: "", words, gold, labelA: c.labelA, labelB: c.labelB });
  }
  out.sort((a, b) => (a.words.join() < b.words.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    const aCount = Object.values(p.gold).filter((s) => s === "A").length;
    const bCount = Object.values(p.gold).filter((s) => s === "B").length;
    if (aCount !== PER_SIDE || bCount !== PER_SIDE) throw new Error(`unbalanced trail ${p.puzzleId}`);
    if (Object.keys(p.gold).length !== SIDE_TOTAL) throw new Error(`bad size ${p.puzzleId}`);
    if (!p.labelA.trim() || !p.labelB.trim()) throw new Error(`missing label ${p.puzzleId}`);
  }
}
