import type { AttemptState, Puzzle } from "./types.ts";

// REQ-015 — hint reveals the start position and length of the answer within the
// carrier (not the letters). Sets hintRevealed; does not consume an attempt.
export interface HintOutcome {
  state: AttemptState;
  startIndex: number;
  length: number;
}

export function applyHint(state: AttemptState, puzzle: Puzzle): HintOutcome | null {
  if (state.status !== "in_progress") return null;
  const startIndex = puzzle.carrierWord.indexOf(puzzle.answerWord);
  if (startIndex < 0) return null; // dataset inconsistency (gate prevents this)
  return {
    state: { ...state, hintRevealed: true },
    startIndex,
    length: puzzle.answerWord.length,
  };
}
