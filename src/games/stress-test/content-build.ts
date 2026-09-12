import type { Puzzle, StressWord } from "./types.ts";
import { ITEM_COUNT } from "./types.ts";

// Build-time content generation + gate. Pure.

export interface CandidateSet { items: StressWord[]; }

export function isValidSet(cand: CandidateSet): boolean {
  if (cand.items.length !== ITEM_COUNT) return false;
  for (const it of cand.items) {
    if (it.syllables.length < 2) return false;
    if (it.stressedIndex < 0 || it.stressedIndex >= it.syllables.length) return false;
    if (it.syllables.join("").toUpperCase() !== it.word.toUpperCase()) return false;
  }
  return true;
}

export function buildPuzzles(candidates: CandidateSet[]): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isValidSet(c)) continue;
    out.push({ puzzleId: "", items: c.items.map((it) => ({ ...it, word: it.word.toUpperCase(), syllables: it.syllables.map((s) => s.toUpperCase()) })) });
  }
  out.sort((a, b) => (a.items[0].word < b.items[0].word ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) if (!isValidSet({ items: p.items })) throw new Error(`invalid ${p.puzzleId}`);
}
