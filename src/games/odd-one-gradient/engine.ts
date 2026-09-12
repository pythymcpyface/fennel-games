import type { AttemptState, Guess, Puzzle, SubmissionResult } from "./types.ts";
import { ATTEMPTS_TOTAL } from "./types.ts";

// Pure Odd-One Gradient engine. No storage, no clock. Deterministic. All scoring
// is precomputed at build time; the engine only reads the shipped heat buckets.

export function normalize(raw: string): string {
  return raw.normalize("NFC").trim().toLowerCase().replace(/[^a-z]/g, "");
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

/** Tap a word as the odd one. */
export function submit(state: AttemptState, puzzle: Puzzle, rawWord: string): SubmissionResult {
  if (state.status !== "in_progress" || state.attemptsRemaining <= 0) {
    return { state, correct: false, error: "no_attempts_remaining" };
  }
  const word = normalize(rawWord);
  const score = puzzle.scores[word];
  if (!score) return { state, correct: false, error: "unknown_word" };
  if (state.guesses.some((g) => g.word === word)) {
    return { state, correct: false, error: "already_guessed" };
  }

  const correct = word === puzzle.odd;
  const guess: Guess = { word, heat: score.heat, correct };
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
