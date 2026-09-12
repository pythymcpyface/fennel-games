import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT, ITEM_COUNT } from "./types.ts";

// Pure Borrowed engine. No storage, no clock. Deterministic.

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    choices: new Array(ITEM_COUNT).fill(""),
    attemptsUsed: 0,
    status: "in_progress",
    locked: new Array(ITEM_COUNT).fill(false),
    history: [],
  };
}

export function setChoice(state: AttemptState, index: number, option: string): AttemptState {
  if (state.status !== "in_progress") return state;
  if (index < 0 || index >= ITEM_COUNT || state.locked[index]) return state;
  const choices = [...state.choices];
  choices[index] = option;
  return { ...state, choices };
}

/** Count words whose chosen option equals the correct answer. */
export function correctCount(choices: string[], answers: string[]): number {
  let n = 0;
  for (let i = 0; i < answers.length; i++) if (choices[i] === answers[i]) n++;
  return n;
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress";
}

export interface SubmitOutcome {
  state: AttemptState;
  correct: number;
  solved: boolean;
}

/** Submit: lock correct matches, count them, win at all-5, else consume an attempt. */
export function submit(state: AttemptState, puzzle: Puzzle): SubmitOutcome {
  if (state.status !== "in_progress") return { state, correct: correctCount(state.choices, puzzle.answers), solved: false };
  const locked = [...state.locked];
  for (let i = 0; i < ITEM_COUNT; i++) if (state.choices[i] === puzzle.answers[i]) locked[i] = true;
  const correct = correctCount(state.choices, puzzle.answers);
  const solved = correct === ITEM_COUNT;
  const attemptsUsed = state.attemptsUsed + 1;
  const status = solved ? "solved" : attemptsUsed >= ATTEMPT_LIMIT ? "failed" : "in_progress";
  return { state: { ...state, locked, attemptsUsed, status, history: [...state.history, correct] }, correct, solved };
}

/** Hint: lock the first unlocked word to its correct answer. */
export function applyHint(state: AttemptState, puzzle: Puzzle): AttemptState | null {
  if (state.status !== "in_progress") return null;
  let slot = -1;
  for (let i = 0; i < ITEM_COUNT; i++) if (!state.locked[i]) { slot = i; break; }
  if (slot === -1) return null;
  const choices = [...state.choices];
  const locked = [...state.locked];
  choices[slot] = puzzle.answers[slot];
  locked[slot] = true;
  return { ...state, choices, locked };
}
