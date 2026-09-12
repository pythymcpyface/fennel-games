import type { AttemptState, Puzzle } from "./types.ts";
import { currentSlotIndex } from "./engine.ts";

// REQ-015 — hint reveals the first letter of the current slot's intended answer.
// Once per slot; null if the puzzle is over or already hinted.
export interface HintOutcome {
  state: AttemptState;
  letter: string;
}

export function applyHint(state: AttemptState, puzzle: Puzzle): HintOutcome | null {
  if (state.outcome !== "in_progress") return null;
  if (state.hintUsedForSlot) return null;
  const slot = currentSlotIndex(state);
  const answer = puzzle.slots[slot]?.answer;
  if (!answer) return null;
  return { state: { ...state, hintUsedForSlot: true }, letter: answer[0] };
}
