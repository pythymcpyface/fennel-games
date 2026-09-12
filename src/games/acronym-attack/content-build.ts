import type { Puzzle } from "./types.ts";

// Build-time content generation + gate. Pure. A puzzle is fair iff, for a given
// acronym, at least one dictionary word starts with each letter (so the puzzle is
// solvable). The gate proves solvability against the bundled dictionary.

export interface CandidatePuzzle {
  acronym: string;
  theme: string;
}

export function isSolvable(cand: CandidatePuzzle, wordsByInitial: Record<string, string[]>): boolean {
  const acronym = cand.acronym.toUpperCase();
  if (!/^[A-Z]{2,8}$/.test(acronym)) return false;
  if (!cand.theme.trim()) return false;
  for (const ch of acronym) {
    if (!(wordsByInitial[ch] && wordsByInitial[ch].length > 0)) return false;
  }
  return true;
}

export function buildPuzzles(candidates: CandidatePuzzle[], wordsByInitial: Record<string, string[]>): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isSolvable(c, wordsByInitial)) continue;
    out.push({ puzzleId: "", acronym: c.acronym.toUpperCase(), theme: c.theme });
  }
  out.sort((a, b) => (a.acronym < b.acronym ? -1 : a.acronym > b.acronym ? 1 : 0));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[], wordsByInitial: Record<string, string[]>): void {
  for (const p of puzzles) {
    if (!isSolvable({ acronym: p.acronym, theme: p.theme }, wordsByInitial)) throw new Error(`unsolvable ${p.puzzleId}`);
  }
}
