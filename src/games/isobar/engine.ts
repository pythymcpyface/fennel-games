import type { AttemptState, Placement, Puzzle, WordHint } from "./types.ts";
import { WORD_COUNT } from "./types.ts";

// Pure Isobar engine. No storage, no clock. Deterministic ring-placement scoring.

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    placement: new Array(puzzle.words.length).fill(null),
    attempts: 0,
    isSolved: false,
    history: [],
  };
}

/** REQ-006/007 — place word `wordIdx` onto `ring` (or clear with null). */
export function place(state: AttemptState, wordIdx: number, ring: number | null, puzzle: Puzzle): AttemptState {
  if (state.isSolved) return state;
  if (wordIdx < 0 || wordIdx >= puzzle.words.length) return state;
  if (ring !== null && (ring < 0 || ring >= puzzle.ringCount)) return state;
  const placement = [...state.placement];
  placement[wordIdx] = ring;
  return { ...state, placement };
}

/** REQ-009 — are all words placed? */
export function isComplete(placement: Placement): boolean {
  return placement.length === WORD_COUNT && placement.every((r) => r !== null);
}

/** REQ-010 — number of words on the correct ring. */
export function correctCount(placement: Placement, puzzle: Puzzle): number {
  let n = 0;
  for (let i = 0; i < puzzle.words.length; i++) {
    if (placement[i] === puzzle.correctRings[i]) n++;
  }
  return n;
}

/** REQ-011/012 — per-word hints (correct / off-by-one w/ direction / other). */
export function hints(placement: Placement, puzzle: Puzzle): WordHint[] {
  return puzzle.words.map((word, i) => {
    const p = placement[i];
    const c = puzzle.correctRings[i];
    if (p === null) return { word, status: "other_incorrect" as const };
    if (p === c) return { word, status: "correct" as const };
    if (Math.abs(p - c) === 1) {
      // placed too far out (p > c) => need to go nearer; placed too near (p < c) => farther.
      const direction = p > c ? ("nearer" as const) : ("farther" as const);
      return { word, status: "off_by_one" as const, direction };
    }
    return { word, status: "other_incorrect" as const };
  });
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "incomplete" | "terminal";
  correct?: number;
  hints?: WordHint[];
  solved?: boolean;
}

/** REQ-009..016 — validate completeness, score, append attempt, mark solved. */
export function submit(state: AttemptState, puzzle: Puzzle): SubmitOutcome {
  if (state.isSolved) return { state, accepted: false, reason: "terminal" };
  if (!isComplete(state.placement)) return { state, accepted: false, reason: "incomplete" };
  const correct = correctCount(state.placement, puzzle);
  const solved = correct === puzzle.words.length;
  const next: AttemptState = {
    ...state,
    attempts: state.attempts + 1,
    isSolved: solved,
    history: [...state.history, correct],
  };
  return { state: next, accepted: true, correct, hints: hints(state.placement, puzzle), solved };
}

export function canSubmit(state: AttemptState): boolean {
  return !state.isSolved && isComplete(state.placement);
}
