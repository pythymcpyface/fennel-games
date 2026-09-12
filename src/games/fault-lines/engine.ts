import type { AttemptState, AuditResult, Puzzle } from "./types.ts";

// Pure Fault Lines engine. No storage, no clock. Flag toggling + audit scoring.
// The player flags suspected faulty entries; scoring rewards correct flags and
// penalises false accusations.

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    flags: puzzle.entries.map(() => false),
    isComplete: false,
  };
}

export interface ToggleOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "complete" | "out-of-range";
}

/**
 * REQ-007 — toggle the player flag for one entry. Rejected once submitted
 * (REQ-006 lock). Only the targeted entry changes.
 */
export function toggleFlag(state: AttemptState, puzzle: Puzzle, entryIndex: number): ToggleOutcome {
  if (state.isComplete) return { state, accepted: false, reason: "complete" };
  if (entryIndex < 0 || entryIndex >= puzzle.entries.length) return { state, accepted: false, reason: "out-of-range" };
  const flags = state.flags.slice();
  flags[entryIndex] = !flags[entryIndex];
  return { state: { ...state, flags }, accepted: true };
}

/** REQ-010..014 — evaluate flags against hidden ground truth. Pure. */
export function scoreAudit(state: AttemptState, puzzle: Puzzle): AuditResult {
  let correctFlags = 0;
  let falseAccusations = 0;
  const correctnessByEntry = puzzle.entries.map((entry, i) => {
    const flagged = state.flags[i] === true;
    if (flagged && entry.isFaulty) correctFlags++;
    else if (flagged && !entry.isFaulty) falseAccusations++;
    return flagged === entry.isFaulty;
  });
  const score = correctFlags - falseAccusations;
  const solved = correctFlags === puzzle.faultCount && falseAccusations === 0;
  return { correctFlags, falseAccusations, score, solved, correctnessByEntry };
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "complete";
  result?: AuditResult;
}

/** REQ-015/016 — finalize the audit once. Idempotent: a second submit is rejected. */
export function submit(state: AttemptState, puzzle: Puzzle): SubmitOutcome {
  if (state.isComplete) return { state, accepted: false, reason: "complete" };
  const result = scoreAudit(state, puzzle);
  return { state: { ...state, isComplete: true }, accepted: true, result };
}

export function canSubmit(state: AttemptState): boolean {
  return !state.isComplete;
}
