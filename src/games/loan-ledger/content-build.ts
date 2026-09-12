import type { Puzzle, MorphemeWord } from "./types.ts";
import { ITEM_COUNT } from "./types.ts";

// Build-time content generation + gate. Pure.

export interface CandidateSet {
  items: MorphemeWord[];
  extraOptions?: string[];
}

export function isValidSet(cand: CandidateSet): boolean {
  if (cand.items.length !== ITEM_COUNT) return false;
  if (new Set(cand.items.map((it) => it.word.toLowerCase())).size !== ITEM_COUNT) return false;
  if (new Set(cand.items.map((it) => it.answer.toLowerCase())).size !== ITEM_COUNT) return false;
  for (const it of cand.items) {
    if (!/^[a-z]+$/i.test(it.word)) return false;
    if (it.morphemes.length < 2) return false;
    if (!it.answer.trim()) return false;
  }
  return true;
}

export function buildPuzzles(candidates: CandidateSet[]): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isValidSet(c)) continue;
    const answers = c.items.map((it) => it.answer);
    const options = [...new Set([...answers, ...(c.extraOptions ?? [])])].sort();
    out.push({ puzzleId: "", items: c.items.map((it) => ({ ...it, word: it.word.toUpperCase() })), options });
  }
  out.sort((a, b) => (a.items[0].word < b.items[0].word ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    if (!isValidSet({ items: p.items })) throw new Error(`invalid ${p.puzzleId}`);
    if (!p.items.every((it) => p.options.includes(it.answer))) throw new Error(`option missing ${p.puzzleId}`);
  }
}
