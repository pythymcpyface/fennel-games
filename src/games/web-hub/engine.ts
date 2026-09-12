import type { AttemptState, Guess, Puzzle, SubmissionResult } from "./types.ts";
import { ATTEMPTS_TOTAL } from "./types.ts";

// Pure Web Hub engine. No storage, no clock. Deterministic.

export function normalize(raw: string): string {
  return raw.normalize("NFC").trim().toLowerCase().replace(/[^a-z]/g, "");
}

/** Within-board degree of `word`: number of board neighbours one letter apart. */
export function boardDegree(word: string, adjacency: Record<string, string[]>): number {
  return (adjacency[word] ?? []).length;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    guesses: [],
    attemptsRemaining: ATTEMPTS_TOTAL,
    status: "in_progress",
  };
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress" && state.attemptsRemaining > 0;
}

/** Tap a word as the hub. */
export function submit(state: AttemptState, puzzle: Puzzle, rawWord: string): SubmissionResult {
  if (state.status !== "in_progress" || state.attemptsRemaining <= 0) {
    return { state, correct: false, error: "no_attempts_remaining" };
  }
  const word = normalize(rawWord);
  if (!(word in puzzle.degrees)) return { state, correct: false, error: "unknown_word" };
  if (state.guesses.some((g) => g.word === word)) {
    return { state, correct: false, error: "already_guessed" };
  }

  const correct = word === puzzle.hub;
  const guess: Guess = { word, degree: puzzle.degrees[word], correct };
  const guesses = [...state.guesses, guess];
  if (correct) {
    return { state: { ...state, guesses, status: "won" }, correct: true, error: null, guess };
  }
  const attemptsRemaining = state.attemptsRemaining - 1;
  const lost = attemptsRemaining <= 0;
  return {
    state: { ...state, guesses, attemptsRemaining, status: lost ? "lost" : "in_progress" },
    correct: false,
    error: null,
    guess,
  };
}
