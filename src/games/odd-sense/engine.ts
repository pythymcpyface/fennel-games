import type { AttemptState, GuessResult, Puzzle } from "./types.ts";
import { MAX_ATTEMPTS } from "./types.ts";

// Pure gameplay engine (TERM-026). No storage, no clock.

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    state: "in_progress",
    guessHistory: [],
    remainingAttempts: MAX_ATTEMPTS,
    hintUsed: false,
    eliminatedWordIndex: null,
  };
}

/** REQ-008 — evaluate a selection against the odd word. */
export function evaluateGuess(selectedWordIndex: number, oddWordIndex: number): GuessResult {
  return selectedWordIndex === oddWordIndex ? "CORRECT" : "INCORRECT";
}

export interface SubmitOutcome {
  state: AttemptState;
  result: GuessResult;
}

/** Can a guess be submitted right now? */
export function canGuess(state: AttemptState): boolean {
  return state.state === "in_progress" && state.remainingAttempts > 0;
}

/**
 * REQ-007/008/009/010/011/012 — submit a selection. Rejects unset/eliminated/out-of-range
 * selection (returns unchanged with INCORRECT-less no-op). Applies transitions.
 */
export function submit(state: AttemptState, puzzle: Puzzle, selectedWordIndex: number): SubmitOutcome | null {
  if (!canGuess(state)) return null;
  if (selectedWordIndex < 0 || selectedWordIndex >= puzzle.words.length) return null;
  if (state.eliminatedWordIndex === selectedWordIndex) return null; // REQ-015

  const result = evaluateGuess(selectedWordIndex, puzzle.oddWordIndex);
  const attemptNumber = state.guessHistory.length + 1;
  const guessHistory = [...state.guessHistory, { attemptNumber, selectedWordIndex, result }];

  if (result === "CORRECT") {
    return { state: { ...state, state: "solved", guessHistory }, result };
  }
  const remainingAttempts = state.remainingAttempts - 1;
  const nextState = remainingAttempts <= 0 ? "failed" : "in_progress";
  return {
    state: { ...state, state: nextState, guessHistory, remainingAttempts },
    result,
  };
}
