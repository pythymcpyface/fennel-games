import type { AttemptState, Puzzle, SubmissionFeedback } from "./types.ts";
import { ATTEMPTS_TOTAL } from "./types.ts";

// Pure Homophone Heist engine. No storage, no clock. Deterministic.
// `homophones` maps a word -> set of its homophones (uppercase), used for feedback.

export function normalize(raw: string): string {
  return raw.normalize("NFC").trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId, dayId,
    solved: new Array(puzzle.answers.length).fill(false),
    attemptsUsed: 0, status: "in_progress", history: [],
  };
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress";
}

export function areHomophones(a: string, b: string, homophones: Record<string, string[]>): boolean {
  if (a === b) return true;
  return (homophones[a]?.includes(b) ?? false) || (homophones[b]?.includes(a) ?? false);
}

export interface SubmitOutcome {
  state: AttemptState;
  correct: boolean;
  feedback?: SubmissionFeedback;
  empty?: boolean;
  alreadySolved?: boolean;
}

/** Submit a guess for slot `index`. Correct iff it equals the intended answer. */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  index: number,
  rawGuess: string,
  homophones: Record<string, string[]>,
): SubmitOutcome {
  if (state.status !== "in_progress") return { state, correct: false };
  if (index < 0 || index >= puzzle.answers.length) return { state, correct: false };
  if (state.solved[index]) return { state, correct: false, alreadySolved: true };
  const guess = normalize(rawGuess);
  if (guess.length === 0) return { state, correct: false, empty: true };

  const answer = puzzle.answers[index];
  if (guess === answer) {
    const solved = [...state.solved];
    solved[index] = true;
    const won = solved.every(Boolean);
    return { state: { ...state, solved, status: won ? "won" : "in_progress" }, correct: true };
  }

  // Feedback: is the guess at least a homophone of the shown token?
  const isHomophone = areHomophones(guess, puzzle.shownTokens[index], homophones);
  const attemptsUsed = state.attemptsUsed + 1;
  const lost = attemptsUsed >= ATTEMPTS_TOTAL;
  return { state: { ...state, attemptsUsed, status: lost ? "lost" : "in_progress" }, correct: false, feedback: { isHomophone } };
}

export function attemptsRemaining(state: AttemptState): number {
  return ATTEMPTS_TOTAL - state.attemptsUsed;
}

/** Hint: reveal the first letter of the current slot's answer. */
export function hintLetter(puzzle: Puzzle, index: number): string | null {
  const a = puzzle.answers[index];
  return a ? a[0] : null;
}
