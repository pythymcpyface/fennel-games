import type { Puzzle } from "./types.ts";
import { COMPOUND_COUNT, HALF_COUNT } from "./types.ts";

// Build-time content generation + perfect-matching uniqueness gate. Pure.

export interface CandidatePuzzle {
  compounds: { left: string; right: string }[]; // 4 compounds as (left,right) splits
}

/** Count the perfect matchings of the 8 halves into `compounds` (as a set). */
export function countPerfectMatchings(halves: string[], compounds: ReadonlySet<string>): number {
  const used = new Array(halves.length).fill(false);
  const targetPairs = Math.floor(halves.length / 2);
  let count = 0;
  const recurse = (pairsMade: number) => {
    if (pairsMade === targetPairs) { count++; return; }
    // find first unused index
    let i = 0;
    while (i < halves.length && used[i]) i++;
    if (i >= halves.length) return;
    used[i] = true;
    for (let j = 0; j < halves.length; j++) {
      if (used[j] || j === i) continue;
      // Either concatenation order may form a compound (matching is order-independent).
      if (compounds.has(halves[i] + halves[j]) || compounds.has(halves[j] + halves[i])) {
        used[j] = true;
        recurse(pairsMade + 1);
        used[j] = false;
      }
    }
    used[i] = false;
  };
  recurse(0);
  return count;
}

/** REQ-013 — a candidate is fair iff its 8 halves admit EXACTLY ONE perfect matching. */
export function isFair(cand: CandidatePuzzle): boolean {
  if (cand.compounds.length !== COMPOUND_COUNT) return false;
  const halves: string[] = [];
  const compounds = new Set<string>();
  for (const c of cand.compounds) {
    const left = c.left.toUpperCase();
    const right = c.right.toUpperCase();
    if (!/^[A-Z]+$/.test(left) || !/^[A-Z]+$/.test(right)) return false;
    halves.push(left, right);
    compounds.add(left + right);
  }
  if (halves.length !== HALF_COUNT) return false;
  if (compounds.size !== COMPOUND_COUNT) return false;
  return countPerfectMatchings(halves, compounds) === 1;
}

export function buildPuzzles(candidates: CandidatePuzzle[]): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isFair(c)) continue;
    const halves = c.compounds.flatMap((x) => [x.left.toUpperCase(), x.right.toUpperCase()]);
    const compounds = c.compounds.map((x) => (x.left + x.right).toUpperCase());
    // Deterministic display order: sort halves so the shipped order is stable
    // (the UI shuffles for presentation; the pack order is canonical).
    out.push({ puzzleId: "", halves: [...halves].sort(), compounds: [...compounds].sort() });
  }
  out.sort((a, b) => (a.compounds.join() < b.compounds.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    const compounds = new Set(p.compounds);
    if (countPerfectMatchings(p.halves, compounds) !== 1) throw new Error(`ambiguous matching ${p.puzzleId}`);
  }
}
