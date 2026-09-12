import type { AttemptState, GuessRow, Mark, Puzzle } from "./types.ts";
import { GUESS_BUDGET, WORD_LEN } from "./types.ts";

// Pure Driftword engine. No storage, no clock. Deterministic Wordle-style scoring
// against a DRIFTING target that walks the puzzle's word-ladder path.

/** Wordle two-pass scoring of `guess` vs `target` (handles duplicate letters). */
export function score(guess: string, target: string): Mark[] {
  const g = guess.toUpperCase();
  const t = target.toUpperCase();
  const marks: Mark[] = new Array(WORD_LEN).fill("X");
  const pool = new Map<string, number>();
  for (let i = 0; i < WORD_LEN; i++) {
    if (g[i] === t[i]) marks[i] = "G";
    else pool.set(t[i], (pool.get(t[i]) ?? 0) + 1);
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (marks[i] === "G") continue;
    const c = g[i];
    const avail = pool.get(c) ?? 0;
    if (avail > 0) {
      marks[i] = "Y";
      pool.set(c, avail - 1);
    }
  }
  return marks;
}

/** The target index that applies on turn `turn` (0-based), clamped to path end. */
export function targetIndexForTurn(turn: number, pathLen: number): number {
  return Math.min(turn, pathLen - 1);
}

/** The target word for a given turn. */
export function targetForTurn(puzzle: Puzzle, turn: number): string {
  return puzzle.path[targetIndexForTurn(turn, puzzle.path.length)];
}

export function isWellFormed(guess: string): boolean {
  return /^[A-Za-z]{5}$/.test(guess.trim());
}

export function isValidGuess(guess: string, dictionary: ReadonlySet<string>): boolean {
  return isWellFormed(guess) && dictionary.has(guess.trim().toUpperCase());
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, rows: [], isSolved: false, isFailed: false };
}

export function canSubmit(state: AttemptState): boolean {
  return !state.isSolved && !state.isFailed && state.rows.length < GUESS_BUDGET;
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "well-formed" | "dictionary" | "terminal";
  row?: GuessRow;
  solved?: boolean;
}

/**
 * Submit a guess: score against the CURRENT turn's drifted target, append the row,
 * evaluate win (guess == current target) / loss (budget exhausted).
 */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  dictionary: ReadonlySet<string>,
  guess: string,
): SubmitOutcome {
  if (!canSubmit(state)) return { state, accepted: false, reason: "terminal" };
  if (!isWellFormed(guess)) return { state, accepted: false, reason: "well-formed" };
  const norm = guess.trim().toUpperCase();
  if (!dictionary.has(norm)) return { state, accepted: false, reason: "dictionary" };

  const turn = state.rows.length;
  const tIdx = targetIndexForTurn(turn, puzzle.path.length);
  const target = puzzle.path[tIdx];
  const marks = score(norm, target);
  const row: GuessRow = { guess: norm, marks, targetIndex: tIdx };
  const rows = [...state.rows, row];

  const solved = norm === target.toUpperCase();
  const failed = !solved && rows.length >= GUESS_BUDGET;
  return {
    state: { ...state, rows, isSolved: solved, isFailed: failed },
    accepted: true,
    row,
    solved,
  };
}
