import type { AttemptState, GuessRow, Puzzle } from "./types.ts";
import { CLOSENESS_MAX, GUESS_BUDGET } from "./types.ts";

// Pure Parallax engine. No storage, no clock, no vectors. All feedback is a lookup
// into the puzzle's precomputed table (TERM-030). Deterministic across platforms.

/** FIELD-008 — normalize + validate a guess token (letters only, 1..15). */
export function isWellFormed(guess: string): boolean {
  return /^[A-Za-z][A-Za-z'\-]{0,14}$/.test(guess.trim());
}

/** REQ-007 — the guess must exist in the puzzle's feedback table (its vocabulary). */
export function isValidGuess(guess: string, puzzle: Puzzle): boolean {
  return isWellFormed(guess) && normalize(guess) in puzzle.table;
}

export function normalize(guess: string): string {
  return guess.trim().toUpperCase();
}

/** REQ-007 — fresh attempt. */
export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, rows: [], isSolved: false, isFailed: false };
}

/** REQ-016 — can the player still submit? */
export function canSubmit(state: AttemptState): boolean {
  return !state.isSolved && !state.isFailed && state.rows.length < GUESS_BUDGET;
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "well-formed" | "vocab" | "terminal" | "duplicate";
  row?: GuessRow;
  solved?: boolean;
}

/**
 * REQ-009..016 — validate, look up balance+closeness, append, evaluate win/lose.
 * Win: closeness reaches CLOSENESS_MAX (the guess IS the target word).
 */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  guess: string,
): SubmitOutcome {
  if (!canSubmit(state)) return { state, accepted: false, reason: "terminal" };
  if (!isWellFormed(guess)) return { state, accepted: false, reason: "well-formed" };
  const norm = normalize(guess);
  const entry = puzzle.table[norm];
  if (entry === undefined) return { state, accepted: false, reason: "vocab" };
  if (state.rows.some((r) => r.guess === norm)) return { state, accepted: false, reason: "duplicate" };

  const row: GuessRow = { guess: norm, balance: entry.balance, closeness: entry.closeness };
  const rows = [...state.rows, row];
  const isSolved = norm === puzzle.target || row.closeness >= CLOSENESS_MAX;
  const isFailed = !isSolved && rows.length >= GUESS_BUDGET;
  return { state: { ...state, rows, isSolved, isFailed }, accepted: true, row, solved: isSolved };
}
