import type { AttemptState, Puzzle } from "./types.ts";

// REQ-013/014 — hint: eliminate one themed (non-odd) word. Uses the puzzle's
// precomputed deterministic hintEliminationIndex so the choice is identical across
// platforms (EDGE-005). Once used, it cannot be used again. Null if unavailable.
export function applyHint(state: AttemptState, puzzle: Puzzle): AttemptState | null {
  if (state.state !== "in_progress") return null;
  if (state.hintUsed) return null;
  const idx = puzzle.hintEliminationIndex;
  if (idx === puzzle.oddWordIndex) return null; // safety: never eliminate the odd word
  return { ...state, hintUsed: true, eliminatedWordIndex: idx };
}
