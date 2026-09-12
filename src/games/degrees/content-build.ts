import type { Puzzle } from "./types.ts";
import { SET_SIZE } from "./types.ts";

// Build-time content generation + gate (TERM-024, JOURNEY-006). Pure.

export interface CandidateSet {
  words: string[]; // MUST already be in canonical weakest->strongest order
  scaleLabel: string;
}

/** REQ-018/019/020 — 5 distinct alpha words + non-empty label. */
export function isValidSet(cand: CandidateSet): boolean {
  if (cand.words.length !== SET_SIZE) return false;
  const lower = cand.words.map((w) => w.toLowerCase());
  if (new Set(lower).size !== SET_SIZE) return false;
  if (!cand.words.every((w) => /^[a-z]+$/i.test(w))) return false;
  if (!cand.scaleLabel.trim()) return false;
  return true;
}

export function buildPuzzles(candidates: CandidateSet[]): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isValidSet(c)) continue;
    out.push({ puzzleId: "", words: c.words.map((w) => w.toLowerCase()), scaleLabel: c.scaleLabel });
  }
  out.sort((a, b) => (a.words.join() < b.words.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    if (!isValidSet({ words: p.words, scaleLabel: p.scaleLabel })) throw new Error(`invalid set ${p.puzzleId}`);
  }
}
