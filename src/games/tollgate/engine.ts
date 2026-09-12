import type { AttemptState, Puzzle } from "./types.ts";
import { A_CODE } from "./types.ts";

// Pure Tollgate engine. No storage, no clock. Weighted word-ladder rules.

/** The single differing index between two equal-length words, or -1 if diff != 1. */
export function singleDiffIndex(a: string, b: string): number {
  if (a.length !== b.length) return -1;
  let idx = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (idx !== -1) return -1; // more than one diff
      idx = i;
    }
  }
  return idx; // -1 if identical, else the single differing index
}

/** Toll of a letter via the puzzle's toll table. */
export function tollOf(letter: string, tolls: number[]): number {
  const code = letter.toUpperCase().charCodeAt(0) - A_CODE;
  return code >= 0 && code < tolls.length ? tolls[code] : 0;
}

/** REQ-009 — cost of moving from `from` to `to` = toll of the introduced letter. */
export function moveCost(from: string, to: string, tolls: number[]): number {
  const idx = singleDiffIndex(from, to);
  if (idx < 0) return Number.POSITIVE_INFINITY;
  return tollOf(to[idx], tolls);
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, path: [puzzle.start.toUpperCase()], totalCost: 0, isSolved: false };
}

export function currentWord(state: AttemptState): string {
  return state.path[state.path.length - 1];
}

export type MoveReason = "length" | "not-one-change" | "dictionary" | "terminal";

export interface MoveOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: MoveReason;
  cost?: number;
  solved?: boolean;
}

/** REQ-005..013 — attempt a move to `next`; validate + accumulate cost + solve. */
export function move(
  state: AttemptState,
  puzzle: Puzzle,
  dictionary: ReadonlySet<string>,
  next: string,
): MoveOutcome {
  if (state.isSolved) return { state, accepted: false, reason: "terminal" };
  const to = next.trim().toUpperCase();
  const from = currentWord(state);
  if (to.length !== from.length) return { state, accepted: false, reason: "length" };
  const idx = singleDiffIndex(from, to);
  if (idx < 0) return { state, accepted: false, reason: "not-one-change" };
  if (!dictionary.has(to)) return { state, accepted: false, reason: "dictionary" };

  const cost = tollOf(to[idx], puzzle.tolls);
  const path = [...state.path, to];
  const totalCost = state.totalCost + cost;
  const solved = to === puzzle.target.toUpperCase();
  return { state: { ...state, path, totalCost, isSolved: solved }, accepted: true, cost, solved };
}

/** REQ-016/017 — undo the last move; recompute total from remaining path. */
export function undo(state: AttemptState, puzzle: Puzzle): AttemptState {
  if (state.isSolved || state.path.length <= 1) return state;
  const path = state.path.slice(0, -1);
  const totalCost = recomputeCost(path, puzzle.tolls);
  return { ...state, path, totalCost, isSolved: false };
}

/** Sum of move costs implied by consecutive pairs of a path. */
export function recomputeCost(path: string[], tolls: number[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += moveCost(path[i - 1], path[i], tolls);
  return total;
}

export function canMove(state: AttemptState): boolean {
  return !state.isSolved;
}
