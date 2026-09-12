import type { AttemptState, Puzzle, RevealState } from "./types.ts";
import { MAX_GUESSES } from "./types.ts";

// Pure Emoji Etymon engine — Wordle-style reveal. No storage, no clock.

export function normalize(raw: string): string {
  return raw.normalize("NFC").trim().toUpperCase().replace(/[^A-Z]/g, "");
}

/** Two-pass Wordle reveal with correct duplicate-letter handling. */
export function computeReveal(guess: string, answer: string): RevealState[] {
  const n = answer.length;
  const row: RevealState[] = new Array(n).fill("ABSENT");
  const pool = new Map<string, number>();
  for (const ch of answer) pool.set(ch, (pool.get(ch) ?? 0) + 1);
  for (let i = 0; i < n; i++) if (guess[i] === answer[i]) { row[i] = "EXACT"; pool.set(guess[i], pool.get(guess[i])! - 1); }
  for (let i = 0; i < n; i++) {
    if (row[i] === "EXACT") continue;
    const ch = guess[i];
    const rem = pool.get(ch) ?? 0;
    if (rem > 0) { row[i] = "PRESENT"; pool.set(ch, rem - 1); }
  }
  return row;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, rows: [], guesses: [], status: "in_progress", hintUsed: false };
}

export function canGuess(state: AttemptState): boolean {
  return state.status === "in_progress";
}

export type GuessError = "WRONG_LENGTH" | "DUPLICATE" | "ENDED" | "EMPTY";

export interface SubmitOutcome {
  state: AttemptState;
  ok: boolean;
  error?: GuessError;
  row?: RevealState[];
  won?: boolean;
}

export function submit(state: AttemptState, puzzle: Puzzle, rawGuess: string): SubmitOutcome {
  if (state.status !== "in_progress") return { state, ok: false, error: "ENDED" };
  const guess = normalize(rawGuess);
  if (guess.length === 0) return { state, ok: false, error: "EMPTY" };
  if (guess.length !== puzzle.answer.length) return { state, ok: false, error: "WRONG_LENGTH" };
  if (state.guesses.includes(guess)) return { state, ok: false, error: "DUPLICATE" };

  const row = computeReveal(guess, puzzle.answer);
  const rows = [...state.rows, row];
  const guesses = [...state.guesses, guess];
  const won = guess === puzzle.answer;
  const status = won ? "won" : rows.length >= MAX_GUESSES ? "lost" : "in_progress";
  return { state: { ...state, rows, guesses, status }, ok: true, row, won };
}

export function useHint(state: AttemptState): AttemptState {
  return { ...state, hintUsed: true };
}
