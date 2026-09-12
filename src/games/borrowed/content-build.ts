import type { Puzzle } from "./types.ts";
import { ITEM_COUNT } from "./types.ts";

// Build-time content generation + gate. Pure. A set is valid iff 5 distinct words,
// each with a source language, and the option pool contains every answer plus enough
// distractors (>= answers, unique).

export interface CandidateSet {
  words: string[];
  answers: string[]; // source language per word
  extraOptions?: string[]; // distractor languages
}

export function isValidSet(cand: CandidateSet): boolean {
  if (cand.words.length !== ITEM_COUNT || cand.answers.length !== ITEM_COUNT) return false;
  if (new Set(cand.words.map((w) => w.toLowerCase())).size !== ITEM_COUNT) return false;
  if (!cand.words.every((w) => /^[a-z]+$/i.test(w))) return false;
  if (cand.answers.some((a) => !a.trim())) return false;
  return true;
}

export function buildPuzzles(candidates: CandidateSet[]): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isValidSet(c)) continue;
    const options = [...new Set([...c.answers, ...(c.extraOptions ?? [])])].sort();
    out.push({ puzzleId: "", words: c.words.map((w) => w.toUpperCase()), answers: c.answers, options });
  }
  out.sort((a, b) => (a.words.join() < b.words.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    if (!isValidSet({ words: p.words, answers: p.answers })) throw new Error(`invalid ${p.puzzleId}`);
    if (!p.answers.every((a) => p.options.includes(a))) throw new Error(`option missing ${p.puzzleId}`);
  }
}
