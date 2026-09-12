import type { AttemptState, Puzzle, RevealRow } from "./types.ts";
import { MAX_GUESSES } from "./types.ts";
import { computeReveal, isWinningGuess } from "./reveal.ts";

// Attempt-state transitions (TERM-025). Pure reducers — no storage, no clock.

/** REQ-004 — fresh attempt with a full guess allowance. */
export function initAttempt(puzzleId: string, dayId: string): AttemptState {
  return {
    puzzleId,
    dayId,
    revealGrid: [],
    guesses: [],
    remainingGuesses: MAX_GUESSES,
    isSolved: false,
    isFailed: false,
    hintCountUsed: 0,
    hintedPositions: [],
  };
}

export interface ApplyResult {
  state: AttemptState;
  row: RevealRow;
  won: boolean;
}

/**
 * REQ-010..014 — apply a VALID guess: compute reveal, append row, set solved or
 * decrement allowance and possibly fail. Caller guarantees validity + non-terminal.
 */
export function applyGuess(prev: AttemptState, guess: string, puzzle: Puzzle): ApplyResult {
  const row = computeReveal(guess, puzzle.bridgeWord);
  const won = isWinningGuess(guess, puzzle.bridgeWord);
  const revealGrid = [...prev.revealGrid, row];
  const guesses = [...prev.guesses, guess];
  const remainingGuesses = won ? prev.remainingGuesses : prev.remainingGuesses - 1;
  const isSolved = won;
  const isFailed = !won && remainingGuesses <= 0;
  return {
    state: { ...prev, revealGrid, guesses, remainingGuesses, isSolved, isFailed },
    row,
    won,
  };
}

/** Is a further guess allowed (not solved/failed and allowance remains)? */
export function canGuess(state: AttemptState): boolean {
  return !state.isSolved && !state.isFailed && state.remainingGuesses > 0;
}
