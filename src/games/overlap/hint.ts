import type { AttemptState, Puzzle } from "./types.ts";

// REQ-018 — hint: reveal one additional correct letter position of the bridge.
// Deterministic: always the leftmost not-yet-hinted position, so restored state is
// stable (EDGE-005). Returns the new hinted position + letter, or null if none left
// or the puzzle is complete.

export interface HintResult {
  state: AttemptState;
  position: number;
  letter: string;
}

export function applyHint(state: AttemptState, puzzle: Puzzle): HintResult | null {
  if (state.isSolved || state.isFailed) return null;
  if (state.hintedPositions.length >= puzzle.bridgeLength) return null;

  const hinted = new Set(state.hintedPositions);
  let position = -1;
  for (let i = 0; i < puzzle.bridgeLength; i++) {
    if (!hinted.has(i)) {
      position = i;
      break;
    }
  }
  if (position === -1) return null;

  const next: AttemptState = {
    ...state,
    hintedPositions: [...state.hintedPositions, position],
    hintCountUsed: state.hintCountUsed + 1,
  };
  return { state: next, position, letter: puzzle.bridgeWord[position] };
}
