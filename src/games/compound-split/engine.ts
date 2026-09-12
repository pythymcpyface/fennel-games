import type { AttemptState, Feedback, LockedPair, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT, COMPOUND_COUNT } from "./types.ts";

// Pure Compound Split engine. No storage, no clock. Deterministic.

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, lockedPairs: [], attemptsUsed: 0, status: "in_progress", hintUsed: false, history: [] };
}

/** Indices currently locked into a pair. */
function lockedIndices(state: AttemptState): Set<number> {
  const s = new Set<number>();
  for (const p of state.lockedPairs) { s.add(p.leftIndex); s.add(p.rightIndex); }
  return s;
}

export function isLocked(state: AttemptState, index: number): boolean {
  return lockedIndices(state).has(index);
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress";
}

export interface SubmitOutcome {
  state: AttemptState;
  feedback: Feedback;
}

/** REQ-004..010 — submit a pair of half indices (order = concatenation order). */
export function submitPair(state: AttemptState, puzzle: Puzzle, leftIndex: number, rightIndex: number): SubmitOutcome {
  if (state.status !== "in_progress") return { state, feedback: "NO_ATTEMPTS_LEFT" };
  if (leftIndex === rightIndex || leftIndex < 0 || rightIndex < 0 || leftIndex >= puzzle.halves.length || rightIndex >= puzzle.halves.length) {
    return { state, feedback: "INVALID_SELECTION" };
  }
  const locked = lockedIndices(state);
  if (locked.has(leftIndex) || locked.has(rightIndex)) return { state, feedback: "ALREADY_LOCKED" };

  const concat = puzzle.halves[leftIndex] + puzzle.halves[rightIndex];
  const alreadyFound = new Set(state.lockedPairs.map((p) => p.compound));
  const isCorrect = puzzle.compounds.includes(concat) && !alreadyFound.has(concat);

  if (isCorrect) {
    const pair: LockedPair = { leftIndex, rightIndex, compound: concat };
    const lockedPairs = [...state.lockedPairs, pair];
    const won = lockedPairs.length === COMPOUND_COUNT;
    return { state: { ...state, lockedPairs, status: won ? "won" : "in_progress", history: [...state.history, true] }, feedback: "CORRECT" };
  }

  const attemptsUsed = state.attemptsUsed + 1;
  const status = attemptsUsed >= ATTEMPT_LIMIT ? "lost" : "in_progress";
  return { state: { ...state, attemptsUsed, status, history: [...state.history, false] }, feedback: attemptsUsed >= ATTEMPT_LIMIT ? "NO_ATTEMPTS_LEFT" : "INCORRECT" };
}

/**
 * REQ-011 — hint: lock the lowest-index remaining compound by finding its two halves.
 * Deterministic. Returns null when solved/failed or nothing remains.
 */
export function applyHint(state: AttemptState, puzzle: Puzzle): AttemptState | null {
  if (state.status !== "in_progress") return null;
  const found = new Set(state.lockedPairs.map((p) => p.compound));
  const locked = lockedIndices(state);
  for (const compound of puzzle.compounds) {
    if (found.has(compound)) continue;
    // Find an unlocked (left,right) pair forming this compound.
    for (let i = 0; i < puzzle.halves.length; i++) {
      if (locked.has(i)) continue;
      for (let j = 0; j < puzzle.halves.length; j++) {
        if (i === j || locked.has(j)) continue;
        if (puzzle.halves[i] + puzzle.halves[j] === compound) {
          const lockedPairs = [...state.lockedPairs, { leftIndex: i, rightIndex: j, compound }];
          const won = lockedPairs.length === COMPOUND_COUNT;
          return { ...state, lockedPairs, hintUsed: true, status: won ? "won" : "in_progress" };
        }
      }
    }
  }
  return null;
}
