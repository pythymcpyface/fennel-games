import type { Puzzle } from "./types.ts";

// Build-time content generation + gate. Pure. A candidate is valid iff each shown
// token is a genuine homophone of its intended answer (per the homophone map) and
// the phrase has >= 2 slots.

export interface CandidatePuzzle {
  shownTokens: string[];
  answers: string[];
}

export function isValid(cand: CandidatePuzzle, homophones: Record<string, string[]>): boolean {
  if (cand.shownTokens.length !== cand.answers.length) return false;
  if (cand.answers.length < 2) return false;
  for (let i = 0; i < cand.answers.length; i++) {
    const shown = cand.shownTokens[i].toUpperCase();
    const answer = cand.answers[i].toUpperCase();
    if (!/^[A-Z]+$/.test(shown) || !/^[A-Z]+$/.test(answer)) return false;
    // shown must be a homophone of the answer (or identical, for connective words).
    const homo = shown === answer || (homophones[shown]?.includes(answer) ?? false) || (homophones[answer]?.includes(shown) ?? false);
    if (!homo) return false;
  }
  return true;
}

export function buildPuzzles(candidates: CandidatePuzzle[], homophones: Record<string, string[]>): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isValid(c, homophones)) continue;
    out.push({ puzzleId: "", shownTokens: c.shownTokens.map((t) => t.toUpperCase()), answers: c.answers.map((a) => a.toUpperCase()) });
  }
  out.sort((a, b) => (a.answers.join() < b.answers.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[], homophones: Record<string, string[]>): void {
  for (const p of puzzles) if (!isValid({ shownTokens: p.shownTokens, answers: p.answers }, homophones)) throw new Error(`invalid ${p.puzzleId}`);
}
