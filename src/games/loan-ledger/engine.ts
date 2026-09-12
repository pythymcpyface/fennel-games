import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT, ITEM_COUNT } from "./types.ts";

// Pure Loan Ledger engine. Same "match items to options" shape as Borrowed.

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId, dayId,
    choices: new Array(ITEM_COUNT).fill(""),
    attemptsUsed: 0, status: "in_progress",
    locked: new Array(ITEM_COUNT).fill(false), history: [],
  };
}

export function setChoice(state: AttemptState, index: number, option: string): AttemptState {
  if (state.status !== "in_progress") return state;
  if (index < 0 || index >= ITEM_COUNT || state.locked[index]) return state;
  const choices = [...state.choices];
  choices[index] = option;
  return { ...state, choices };
}

export function correctCount(choices: string[], puzzle: Puzzle): number {
  let n = 0;
  for (let i = 0; i < puzzle.items.length; i++) if (choices[i] === puzzle.items[i].answer) n++;
  return n;
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress";
}

export interface SubmitOutcome { state: AttemptState; correct: number; solved: boolean; }

export function submit(state: AttemptState, puzzle: Puzzle): SubmitOutcome {
  if (state.status !== "in_progress") return { state, correct: correctCount(state.choices, puzzle), solved: false };
  const locked = [...state.locked];
  for (let i = 0; i < ITEM_COUNT; i++) if (state.choices[i] === puzzle.items[i].answer) locked[i] = true;
  const correct = correctCount(state.choices, puzzle);
  const solved = correct === ITEM_COUNT;
  const attemptsUsed = state.attemptsUsed + 1;
  const status = solved ? "solved" : attemptsUsed >= ATTEMPT_LIMIT ? "failed" : "in_progress";
  return { state: { ...state, locked, attemptsUsed, status, history: [...state.history, correct] }, correct, solved };
}

export function applyHint(state: AttemptState, puzzle: Puzzle): AttemptState | null {
  if (state.status !== "in_progress") return null;
  let slot = -1;
  for (let i = 0; i < ITEM_COUNT; i++) if (!state.locked[i]) { slot = i; break; }
  if (slot === -1) return null;
  const choices = [...state.choices];
  const locked = [...state.locked];
  choices[slot] = puzzle.items[slot].answer;
  locked[slot] = true;
  return { ...state, choices, locked };
}
