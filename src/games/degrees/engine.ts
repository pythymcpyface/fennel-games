import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT, SET_SIZE } from "./types.ts";
import { fnv1a32 } from "../../kit/selection.ts";

// Pure Degrees engine. Words are stored in canonical order, so the canonical
// arrangement is the identity permutation [0,1,2,3,4]; order[i] holds the canonical
// index currently placed at slot i. Solved iff order[i] === i for all i.

/** Deterministic shuffle of [0..n-1] seeded by a string (Fisher–Yates w/ FNV PRNG). */
export function seededShuffle(n: number, seed: string): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  let h = fnv1a32(seed);
  const next = () => {
    // xorshift-ish step over the 32-bit hash for a deterministic stream.
    h ^= (h << 13) >>> 0;
    h ^= h >>> 17;
    h ^= (h << 5) >>> 0;
    return (h >>> 0) / 0xffffffff;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Guarantee it is not already solved (avoid a trivial daily).
  if (arr.every((v, i) => v === i) && n > 1) [arr[0], arr[1]] = [arr[1], arr[0]];
  return arr;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  const order = seededShuffle(SET_SIZE, `${puzzle.puzzleId}|${dayId}`);
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    order,
    lockedPositions: new Array(SET_SIZE).fill(false),
    attemptsUsed: 0,
    status: "in_progress",
    hintUses: 0,
    history: [],
  };
}

/** REQ-004 — move the item at `from` to `to`, shifting others; locked slots are fixed. */
export function reorder(state: AttemptState, from: number, to: number): AttemptState {
  if (state.status !== "in_progress") return state;
  if (from < 0 || to < 0 || from >= SET_SIZE || to >= SET_SIZE || from === to) return state;
  if (state.lockedPositions[from] || state.lockedPositions[to]) return state;
  const order = [...state.order];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  // Restore locked positions to their canonical placement (locks are absolute slots).
  for (let i = 0; i < SET_SIZE; i++) {
    if (state.lockedPositions[i] && order[i] !== i) {
      // Re-derive: locked slot i must hold canonical index i. Rebuild safely.
      return state; // reject moves that would disturb a lock
    }
  }
  return { ...state, order };
}

/** REQ-005 — count slots where the placed canonical index matches the slot index. */
export function correctPositionCount(order: number[]): number {
  let n = 0;
  for (let i = 0; i < order.length; i++) if (order[i] === i) n++;
  return n;
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress";
}

export interface SubmitOutcome {
  state: AttemptState;
  correct: number;
  solved: boolean;
}

/** REQ-005..010 — evaluate the current order. */
export function submit(state: AttemptState): SubmitOutcome {
  if (state.status !== "in_progress") return { state, correct: correctPositionCount(state.order), solved: false };
  const correct = correctPositionCount(state.order);
  const solved = correct === SET_SIZE;
  const attemptsUsed = state.attemptsUsed + 1;
  const status = solved ? "solved" : attemptsUsed >= ATTEMPT_LIMIT ? "failed" : "in_progress";
  return {
    state: { ...state, attemptsUsed, status, history: [...state.history, correct] },
    correct,
    solved,
  };
}

/** REQ-011 — hint: lock the first unlocked slot to its canonical word. */
export function applyHint(state: AttemptState): AttemptState | null {
  if (state.status !== "in_progress") return null;
  let slot = -1;
  for (let i = 0; i < SET_SIZE; i++) if (!state.lockedPositions[i]) { slot = i; break; }
  if (slot === -1) return null;
  // Place canonical index `slot` at position `slot`, swapping out whatever was there.
  const order = [...state.order];
  const cur = order.indexOf(slot);
  [order[slot], order[cur]] = [order[cur], order[slot]];
  const lockedPositions = [...state.lockedPositions];
  lockedPositions[slot] = true;
  return { ...state, order, lockedPositions, hintUses: state.hintUses + 1 };
}
