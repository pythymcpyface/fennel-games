import type { AttemptState, Attempt, Puzzle, SubmissionResult } from "./types.ts";
import { ATTEMPTS_TOTAL, RANK_SIZE } from "./types.ts";

// Pure Tier List engine. No storage, no clock. Deterministic.

export function normalize(raw: string): string {
  return raw.normalize("NFC").trim().toLowerCase().replace(/[^a-z]/g, "");
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    attempts: [],
    attemptsRemaining: ATTEMPTS_TOTAL,
    status: "in_progress",
  };
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress" && state.attemptsRemaining > 0;
}

/** Count words placed at their correct rank position. */
export function countPositions(ordering: readonly string[], order: readonly string[]): number {
  let n = 0;
  for (let i = 0; i < order.length; i++) if (ordering[i] === order[i]) n += 1;
  return n;
}

/** Submit a full ordering (most-common first). */
export function submit(state: AttemptState, puzzle: Puzzle, rawOrdering: readonly string[]): SubmissionResult {
  if (state.status !== "in_progress" || state.attemptsRemaining <= 0) {
    return { state, correct: false, error: "no_attempts_remaining" };
  }
  const ordering = rawOrdering.map(normalize);
  if (ordering.length !== RANK_SIZE) return { state, correct: false, error: "wrong_length" };
  const boardSet = new Set(puzzle.words);
  if (ordering.some((w) => !boardSet.has(w)) || new Set(ordering).size !== RANK_SIZE) {
    return { state, correct: false, error: "unknown_word" };
  }

  const correctPositions = countPositions(ordering, puzzle.order);
  const solved = correctPositions === RANK_SIZE;
  const attempt: Attempt = { ordering: [...ordering], correctPositions, solved };
  const attempts = [...state.attempts, attempt];
  if (solved) {
    return { state: { ...state, attempts, status: "won" }, correct: true, error: null, attempt };
  }
  const attemptsRemaining = state.attemptsRemaining - 1;
  const lost = attemptsRemaining <= 0;
  return {
    state: { ...state, attempts, attemptsRemaining, status: lost ? "lost" : "in_progress" },
    correct: false,
    error: null,
    attempt,
  };
}
