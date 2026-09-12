import type { AttemptState, Attempt, Puzzle, Side, SubmissionResult } from "./types.ts";
import { ATTEMPTS_TOTAL, SIDE_TOTAL } from "./types.ts";

// Pure Twin Trails engine. No storage, no clock. Deterministic.

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

/** Count words placed on their correct trail. */
export function countCorrect(assignment: Record<string, Side>, gold: Record<string, Side>): number {
  let n = 0;
  for (const w of Object.keys(gold)) if (assignment[w] === gold[w]) n += 1;
  return n;
}

/** Is every board word assigned to a side? */
export function isComplete(assignment: Record<string, Side>, words: readonly string[]): boolean {
  return words.every((w) => assignment[w] === "A" || assignment[w] === "B");
}

/** Submit a full A/B assignment of all board words. */
export function submit(state: AttemptState, puzzle: Puzzle, assignment: Record<string, Side>): SubmissionResult {
  if (state.status !== "in_progress" || state.attemptsRemaining <= 0) {
    return { state, correct: false, error: "no_attempts_remaining" };
  }
  if (!isComplete(assignment, puzzle.words)) {
    return { state, correct: false, error: "incomplete" };
  }
  // normalise to only board words
  const clean: Record<string, Side> = {};
  for (const w of puzzle.words) clean[w] = assignment[w];

  const correctCount = countCorrect(clean, puzzle.gold);
  const solved = correctCount === SIDE_TOTAL;
  const attempt: Attempt = { assignment: clean, correctCount, solved };
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
