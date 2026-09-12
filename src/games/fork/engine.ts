import type { AttemptState, Puzzle } from "./types.ts";

// Pure Fork engine. No storage, no clock. Branching word-ladder rules.

/** Hamming distance for equal-length words; -1 if lengths differ. */
export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return -1;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

export function isOneLetterChange(a: string, b: string): boolean {
  return hamming(a, b) === 1;
}

export function isValidStep(prev: string, next: string, dictionary: ReadonlySet<string>): boolean {
  return isOneLetterChange(prev, next) && dictionary.has(next.toUpperCase());
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    trunk: [puzzle.start.toUpperCase()],
    forkIndex: null,
    branchA: [],
    branchB: [],
    isComplete: false,
  };
}

export type StepReason = "length" | "dictionary" | "not-one-change" | "complete";

export interface StepOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: StepReason;
}

/** REQ-008 — add a word to the trunk (only before a fork is set). */
export function addTrunk(state: AttemptState, puzzle: Puzzle, word: string, dictionary: ReadonlySet<string>): StepOutcome {
  if (state.isComplete) return { state, accepted: false, reason: "complete" };
  const w = word.trim().toUpperCase();
  const prev = state.trunk[state.trunk.length - 1];
  if (w.length !== puzzle.wordLength) return { state, accepted: false, reason: "length" };
  if (!isOneLetterChange(prev, w)) return { state, accepted: false, reason: "not-one-change" };
  if (!dictionary.has(w)) return { state, accepted: false, reason: "dictionary" };
  return { state: { ...state, trunk: [...state.trunk, w] }, accepted: true };
}

/** REQ-009..011 — set the fork index; initialise both branches at the fork word. */
export function setFork(state: AttemptState, index: number): AttemptState {
  if (state.isComplete) return state;
  if (index < 0 || index >= state.trunk.length) return state;
  const forkWord = state.trunk[index];
  return { ...state, forkIndex: index, branchA: [forkWord], branchB: [forkWord] };
}

/** REQ- branch step — add a word to branch A or B. */
export function addBranch(
  state: AttemptState,
  puzzle: Puzzle,
  which: "A" | "B",
  word: string,
  dictionary: ReadonlySet<string>,
): StepOutcome {
  if (state.isComplete) return { state, accepted: false, reason: "complete" };
  if (state.forkIndex === null) return { state, accepted: false, reason: "not-one-change" };
  const branch = which === "A" ? state.branchA : state.branchB;
  const w = word.trim().toUpperCase();
  const prev = branch[branch.length - 1];
  if (w.length !== puzzle.wordLength) return { state, accepted: false, reason: "length" };
  if (!isOneLetterChange(prev, w)) return { state, accepted: false, reason: "not-one-change" };
  if (!dictionary.has(w)) return { state, accepted: false, reason: "dictionary" };
  const branchA = which === "A" ? [...branch, w] : state.branchA;
  const branchB = which === "B" ? [...branch, w] : state.branchB;
  const next = { ...state, branchA, branchB };
  next.isComplete = branchReaches(next, puzzle);
  return { state: next, accepted: true };
}

/** Both branches end at their respective targets (targets unordered). */
export function branchReaches(state: AttemptState, puzzle: Puzzle): boolean {
  if (state.branchA.length === 0 || state.branchB.length === 0) return false;
  const endA = state.branchA[state.branchA.length - 1];
  const endB = state.branchB[state.branchB.length - 1];
  const A = puzzle.targetA.toUpperCase();
  const B = puzzle.targetB.toUpperCase();
  return (endA === A && endB === B) || (endA === B && endB === A);
}

/** REQ-014 — total steps: trunk transitions up to fork + both branch transitions. */
export function totalSteps(state: AttemptState): number {
  const trunkSteps = state.forkIndex ?? Math.max(0, state.trunk.length - 1);
  const aSteps = Math.max(0, state.branchA.length - 1);
  const bSteps = Math.max(0, state.branchB.length - 1);
  return trunkSteps + aSteps + bSteps;
}

/** Undo last branch word (or trunk word if no fork yet). */
export function undo(state: AttemptState, which: "A" | "B" | "trunk"): AttemptState {
  if (state.isComplete) return state;
  if (which === "trunk" && state.forkIndex === null && state.trunk.length > 1) {
    return { ...state, trunk: state.trunk.slice(0, -1) };
  }
  if (which === "A" && state.branchA.length > 1) return { ...state, branchA: state.branchA.slice(0, -1) };
  if (which === "B" && state.branchB.length > 1) return { ...state, branchB: state.branchB.slice(0, -1) };
  return state;
}
