import type { AttemptState, EntryStatus, Puzzle } from "./types.ts";
import { CANDIDATES_PER_ENTRY } from "./types.ts";

// Pure Clueback engine. No storage, no clock. Selection recording + scoring for
// the reverse-crossword "pick the real clue" mechanic.

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    selections: puzzle.entries.map(() => null),
    isComplete: false,
  };
}

/** REQ-006 — is the recorded selection for `entryIndex` the correct clue? */
export function isSelectionCorrect(state: AttemptState, puzzle: Puzzle, entryIndex: number): boolean {
  const sel = state.selections[entryIndex];
  return sel !== null && sel === puzzle.entries[entryIndex].correctIndex;
}

/** FIELD-015 — status of a single entry given the current selection. */
export function entryStatus(state: AttemptState, puzzle: Puzzle, entryIndex: number): EntryStatus {
  const sel = state.selections[entryIndex];
  if (sel === null || sel === undefined) return "unanswered";
  return sel === puzzle.entries[entryIndex].correctIndex ? "answered_correct" : "answered_incorrect";
}

export interface SelectOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "complete" | "already-answered" | "out-of-range" | "bad-index";
}

/**
 * REQ-005 — record a single selection for one entry. Locks after the first
 * choice (idempotent, EDGE-003): a subsequent select on the same entry is
 * rejected rather than overwriting. Completes the puzzle once all entries are
 * answered (REQ-011 / FIELD-021).
 */
export function select(state: AttemptState, puzzle: Puzzle, entryIndex: number, clueIndex: number): SelectOutcome {
  if (state.isComplete) return { state, accepted: false, reason: "complete" };
  if (entryIndex < 0 || entryIndex >= puzzle.entries.length) return { state, accepted: false, reason: "out-of-range" };
  if (clueIndex < 0 || clueIndex >= CANDIDATES_PER_ENTRY) return { state, accepted: false, reason: "bad-index" };
  if (state.selections[entryIndex] !== null) return { state, accepted: false, reason: "already-answered" };

  const selections = state.selections.slice();
  selections[entryIndex] = clueIndex;
  const isComplete = selections.every((s) => s !== null);
  return { state: { ...state, selections, isComplete }, accepted: true };
}

/** FIELD-017 — number of entries whose selection is correct. */
export function correctCount(state: AttemptState, puzzle: Puzzle): number {
  return puzzle.entries.reduce((n, _e, i) => n + (isSelectionCorrect(state, puzzle, i) ? 1 : 0), 0);
}

/** FIELD-018 — number of entries answered incorrectly. */
export function incorrectCount(state: AttemptState, puzzle: Puzzle): number {
  return state.selections.reduce<number>((n, sel, i) => {
    if (sel === null) return n;
    return n + (sel === puzzle.entries[i].correctIndex ? 0 : 1);
  }, 0);
}

/** FIELD-016 — total entries in the puzzle. */
export function totalEntries(puzzle: Puzzle): number {
  return puzzle.entries.length;
}

/** REQ-011 — completion condition: every entry has a recorded selection. */
export function isComplete(state: AttemptState): boolean {
  return state.selections.every((s) => s !== null);
}

/**
 * Solved = a clean sweep (all entries correct). The hub's streak model is binary
 * (solved/not), so a perfect reverse-solve is the win condition; any wrong clue
 * still completes the day but does not count as solved.
 */
export function isSolved(state: AttemptState, puzzle: Puzzle): boolean {
  return isComplete(state) && correctCount(state, puzzle) === totalEntries(puzzle);
}
