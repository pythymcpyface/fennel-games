import type { Puzzle } from "./types.ts";
import { BOARD_SIZE, CLUSTER_SIZE } from "./types.ts";
import { internalEdges } from "./engine.ts";

// Build-time content generation + uniqueness gate. Pure. The build tool supplies
// candidate boards (a target clique + decoys) plus a board-restricted adjacency
// map; this module verifies the target subset is the UNIQUE densest CLUSTER_SIZE
// subset and shapes fair boards into Puzzles.

export interface CandidateBoard {
  board: string[]; // BOARD_SIZE words, same length
  cluster: string[]; // intended CLUSTER_SIZE answer
  adjacency: Record<string, string[]>; // board-restricted adjacency
}

/** All C(n, k) combinations of `arr` (n small: BOARD_SIZE choose CLUSTER_SIZE). */
export function combinations<T>(arr: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const combo: T[] = [];
  const rec = (start: number): void => {
    if (combo.length === k) {
      out.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1);
      combo.pop();
    }
  };
  rec(0);
  return out;
}

/**
 * A board is FAIR iff:
 *  - it has exactly BOARD_SIZE distinct same-length words;
 *  - the intended cluster is a subset of the board of size CLUSTER_SIZE;
 *  - the intended cluster achieves the STRICTLY maximum internal-edge count over
 *    all CLUSTER_SIZE subsets (unique densest cluster — no tie).
 */
export function isFairBoard(cand: CandidateBoard): boolean {
  const board = cand.board;
  if (new Set(board).size !== BOARD_SIZE) return false;
  const len = board[0]?.length;
  if (!len || board.some((w) => w.length !== len)) return false;
  if (cand.cluster.length !== CLUSTER_SIZE) return false;
  const boardSet = new Set(board);
  if (!cand.cluster.every((w) => boardSet.has(w))) return false;

  const target = internalEdges(cand.cluster, cand.adjacency);
  if (target < 1) return false;
  let maxOther = -1;
  const clusterKey = [...cand.cluster].sort().join(",");
  for (const combo of combinations(board, CLUSTER_SIZE)) {
    if (combo.slice().sort().join(",") === clusterKey) continue;
    const e = internalEdges(combo, cand.adjacency);
    if (e > maxOther) maxOther = e;
  }
  return target > maxOther; // strictly densest — unique optimum
}

export function buildPuzzles(candidates: CandidateBoard[]): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isFairBoard(c)) continue;
    out.push({
      puzzleId: "",
      board: [...c.board].sort(),
      cluster: [...c.cluster].sort(),
      maxEdges: internalEdges(c.cluster, c.adjacency),
      adjacency: c.adjacency,
    });
  }
  out.sort((a, b) => (a.board.join() < b.board.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    const cand: CandidateBoard = { board: p.board, cluster: p.cluster, adjacency: p.adjacency };
    if (!isFairBoard(cand)) throw new Error(`unfair board ${p.puzzleId}`);
    if (internalEdges(p.cluster, p.adjacency) !== p.maxEdges) throw new Error(`maxEdges mismatch ${p.puzzleId}`);
  }
}
