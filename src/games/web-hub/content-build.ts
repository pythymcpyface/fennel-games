import type { Puzzle } from "./types.ts";
import { BOARD_SIZE } from "./types.ts";

// Build-time content generation + uniqueness gate. Pure. The build tool supplies a
// candidate board with a board-restricted adjacency map; this module computes each
// word's within-board degree, derives the hub, and validates the hub's degree is
// STRICTLY the maximum (unique) and clears the runner-up by a fair margin.

export interface CandidateBoard {
  board: string[]; // BOARD_SIZE words, same length
  adjacency: Record<string, string[]>; // board-restricted adjacency
}

export function degrees(cand: CandidateBoard): Record<string, number> {
  const d: Record<string, number> = {};
  for (const w of cand.board) d[w] = (cand.adjacency[w] ?? []).length;
  return d;
}

/** Hub = strictly-highest-degree word. Ties broken lexically (but ties are unfair). */
export function pickHub(cand: CandidateBoard): string | null {
  const d = degrees(cand);
  let hub: string | null = null;
  let best = -1;
  for (const w of [...cand.board].sort()) {
    if (d[w] > best) {
      best = d[w];
      hub = w;
    }
  }
  return hub;
}

/**
 * A board is FAIR iff:
 *  - it has exactly BOARD_SIZE distinct same-length words;
 *  - the hub's within-board degree is the UNIQUE maximum and exceeds the runner-up
 *    by at least `margin` (a clear "most connected" answer, not a near-tie).
 */
export function isFairBoard(cand: CandidateBoard, margin = 2): boolean {
  if (new Set(cand.board).size !== BOARD_SIZE) return false;
  const len = cand.board[0]?.length;
  if (!len || cand.board.some((w) => w.length !== len)) return false;
  const d = degrees(cand);
  const sorted = cand.board.map((w) => d[w]).sort((a, b) => b - a);
  if (sorted[0] < 3) return false; // hub must actually be a hub
  return sorted[0] >= sorted[1] + margin;
}

export function buildPuzzles(candidates: CandidateBoard[], margin = 2): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isFairBoard(c, margin)) continue;
    out.push({
      puzzleId: "",
      board: [...c.board].sort(),
      hub: pickHub(c)!,
      degrees: degrees(c),
      adjacency: c.adjacency,
    });
  }
  out.sort((a, b) => (a.board.join() < b.board.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[], margin = 2): void {
  for (const p of puzzles) {
    const cand: CandidateBoard = { board: p.board, adjacency: p.adjacency };
    if (pickHub(cand) !== p.hub) throw new Error(`hub mismatch ${p.puzzleId}`);
    if (!isFairBoard(cand, margin)) throw new Error(`unfair board ${p.puzzleId}`);
  }
}
