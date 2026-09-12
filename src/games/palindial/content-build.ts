import type { Puzzle } from "./types.ts";
import { reverse } from "./engine.ts";

// Build-time content generation + gate. Pure. A puzzle is valid iff start!=reverse,
// both are dictionary words, and the target (reverse) is reachable from start within
// moveBudget one-letter-change edits. Ships the reachable subgraph.

export function reachableSubgraph(start: string, budget: number, neighbors: Record<string, string[]>): Record<string, string[]> {
  const reachable = new Set([start]);
  let frontier = [start];
  for (let d = 0; d < budget; d++) {
    const next: string[] = [];
    for (const w of frontier) for (const n of neighbors[w] ?? []) if (!reachable.has(n)) { reachable.add(n); next.push(n); }
    if (!next.length) break;
    frontier = next;
  }
  const sub: Record<string, string[]> = {};
  for (const w of reachable) sub[w] = (neighbors[w] ?? []).filter((n) => reachable.has(n)).sort();
  return sub;
}

export interface CandidatePuzzle { startWord: string; moveBudget: number; }

export function buildPuzzle(cand: CandidatePuzzle, fullNeighbors: Record<string, string[]>, dictionary: ReadonlySet<string>, puzzleId: string): Puzzle | null {
  const start = cand.startWord.toUpperCase();
  const target = reverse(start);
  if (start === target) return null; // palindrome, no twin
  if (!dictionary.has(start) || !dictionary.has(target)) return null;
  const sub = reachableSubgraph(start, cand.moveBudget, fullNeighbors);
  if (sub[target] === undefined) return null; // target not reachable within budget
  return { puzzleId, startWord: start, targetWord: target, moveBudget: cand.moveBudget, neighbors: sub };
}

export function buildPuzzles(candidates: CandidatePuzzle[], fullNeighbors: Record<string, string[]>, dictionary: ReadonlySet<string>): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    const p = buildPuzzle(c, fullNeighbors, dictionary, "");
    if (p) out.push(p);
  }
  out.sort((a, b) => (a.startWord < b.startWord ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    if (reverse(p.startWord) !== p.targetWord) throw new Error(`target not reverse ${p.puzzleId}`);
    if (p.neighbors[p.targetWord] === undefined) throw new Error(`target unreachable ${p.puzzleId}`);
  }
}
