import type { Puzzle } from "./types.ts";

// Build-time content generation + gate. Pure. Editorial rebuses; a candidate is
// valid iff it has a non-empty emoji, an alpha answer, and hint text.

export interface CandidatePuzzle {
  emoji: string;
  answer: string;
  hintText: string;
}

export function isValid(cand: CandidatePuzzle): boolean {
  if (!cand.emoji.trim()) return false;
  if (!/^[a-z]+$/i.test(cand.answer)) return false;
  if (cand.answer.length < 3) return false;
  if (!cand.hintText.trim()) return false;
  return true;
}

export function buildPuzzles(candidates: CandidatePuzzle[]): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isValid(c)) continue;
    out.push({ puzzleId: "", emoji: c.emoji, answer: c.answer.toUpperCase(), hintText: c.hintText });
  }
  out.sort((a, b) => (a.answer < b.answer ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) if (!isValid({ emoji: p.emoji, answer: p.answer, hintText: p.hintText })) throw new Error(`invalid ${p.puzzleId}`);
}
