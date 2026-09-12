import type { Puzzle } from "./types.ts";
import { scoreWord } from "./engine.ts";

// Build-time content generation + BFS solvability gate (TERM-015). Pure.

/**
 * REQ-023 — BFS from startWord over the edit-distance graph up to `budget` hops;
 * return the maximum word score reachable within budget (the optimal par).
 */
export function maxReachableScore(
  startWord: string,
  budget: number,
  neighbors: Record<string, string[]>,
  values: Record<string, number>,
): number {
  let best = scoreWord(startWord, values);
  const seen = new Set([startWord]);
  let frontier = [startWord];
  for (let depth = 0; depth < budget; depth++) {
    const next: string[] = [];
    for (const w of frontier) {
      for (const nb of neighbors[w] ?? []) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        next.push(nb);
        best = Math.max(best, scoreWord(nb, values));
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return best;
}

/**
 * Extract the connected subgraph reachable from startWord within `budget` hops,
 * so the shipped pack only carries the words a player could reach (compact).
 */
export function reachableSubgraph(
  startWord: string,
  budget: number,
  neighbors: Record<string, string[]>,
): Record<string, string[]> {
  const reachable = new Set([startWord]);
  let frontier = [startWord];
  for (let depth = 0; depth < budget; depth++) {
    const next: string[] = [];
    for (const w of frontier) {
      for (const nb of neighbors[w] ?? []) {
        if (!reachable.has(nb)) {
          reachable.add(nb);
          next.push(nb);
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  const sub: Record<string, string[]> = {};
  for (const w of reachable) {
    sub[w] = (neighbors[w] ?? []).filter((n) => reachable.has(n)).sort();
  }
  return sub;
}

export interface CandidatePuzzle {
  startWord: string;
  swapBudget: number;
}

/** Build a validated puzzle: par = optimum reachable; gate rejects unsolvable. */
export function buildPuzzle(
  cand: CandidatePuzzle,
  fullNeighbors: Record<string, string[]>,
  values: Record<string, number>,
  puzzleId: string,
): Puzzle | null {
  const start = cand.startWord.toUpperCase();
  const sub = reachableSubgraph(start, cand.swapBudget, fullNeighbors);
  const par = maxReachableScore(start, cand.swapBudget, sub, values);
  // Gate: par must strictly exceed the start score (a meaningful climb exists).
  if (par <= scoreWord(start, values)) return null;
  return { puzzleId, startWord: start, swapBudget: cand.swapBudget, parScore: par, letterValues: values, neighbors: sub };
}

export function buildPuzzles(
  candidates: CandidatePuzzle[],
  fullNeighbors: Record<string, string[]>,
  values: Record<string, number>,
): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    const p = buildPuzzle(c, fullNeighbors, values, "");
    if (p) out.push(p);
  }
  out.sort((a, b) => (a.startWord < b.startWord ? -1 : a.startWord > b.startWord ? 1 : 0));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

/** REQ-024 — every shipped puzzle must be solvable to its par within budget. */
export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    const par = maxReachableScore(p.startWord, p.swapBudget, p.neighbors, p.letterValues);
    if (par !== p.parScore) throw new Error(`par mismatch for ${p.puzzleId}: ${par} != ${p.parScore}`);
  }
}
