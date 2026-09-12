import type { Puzzle } from "./types.ts";
import { bfsDistances } from "./engine.ts";

// Build-time content generation + gate. Pure. A puzzle is valid iff start!=target and
// the target is reachable from start within moveBudget antonym hops. Ships the whole
// (small, curated) antonym graph.

export interface CandidatePuzzle { startWord: string; targetWord: string; moveBudget: number; }

export function isValid(cand: CandidatePuzzle, antonyms: Record<string, string[]>): boolean {
  const start = cand.startWord.toUpperCase();
  const target = cand.targetWord.toUpperCase();
  if (start === target) return false;
  const dist = bfsDistances(start, antonyms);
  const d = dist.get(target);
  return d !== undefined && d >= 1 && d <= cand.moveBudget;
}

export function buildPuzzles(candidates: CandidatePuzzle[], antonyms: Record<string, string[]>): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isValid(c, antonyms)) continue;
    out.push({ puzzleId: "", startWord: c.startWord.toUpperCase(), targetWord: c.targetWord.toUpperCase(), moveBudget: c.moveBudget, antonyms });
  }
  out.sort((a, b) => (a.startWord < b.startWord ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    if (!isValid({ startWord: p.startWord, targetWord: p.targetWord, moveBudget: p.moveBudget }, p.antonyms)) {
      throw new Error(`unreachable ${p.puzzleId}`);
    }
  }
}
