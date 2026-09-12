import type { AttemptState, Category, Puzzle } from "./types.ts";
import { GROUP_SIZE, MISTAKE_BUDGET } from "./types.ts";

// Pure Ghost Group engine. No storage, no clock. Deterministic grouping logic.

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    solved: [],
    mistakes: 0,
    playState: "in_progress",
    ghostPick: null,
    ghostCorrect: null,
    history: [],
  };
}

export function ghostCategory(puzzle: Puzzle): Category {
  const g = puzzle.categories.find((c) => c.isGhost);
  if (!g) throw new Error("no ghost category");
  return g;
}

/** The three given (non-ghost) categories, in stable order. */
export function givenCategories(puzzle: Puzzle): Category[] {
  return puzzle.categories.filter((c) => !c.isGhost);
}

/** Does a set of 4 word indices exactly match some category's membership? */
export function matchCategory(wordIdx: number[], puzzle: Puzzle): Category | null {
  if (wordIdx.length !== GROUP_SIZE) return null;
  const key = [...wordIdx].sort((a, b) => a - b).join(",");
  for (const c of puzzle.categories) {
    if ([...c.wordIdx].sort((a, b) => a - b).join(",") === key) return c;
  }
  return null;
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "size" | "terminal" | "already";
  correctCategoryId?: string;
  correct?: boolean;
}

/**
 * REQ-006..010 — submit a group of exactly 4 word indices. If it matches an
 * unsolved category, that category is solved; otherwise a mistake is consumed.
 */
export function submitGroup(state: AttemptState, puzzle: Puzzle, wordIdx: number[]): SubmitOutcome {
  if (state.playState !== "in_progress") return { state, accepted: false, reason: "terminal" };
  if (wordIdx.length !== GROUP_SIZE) return { state, accepted: false, reason: "size" };
  const match = matchCategory(wordIdx, puzzle);
  if (match && !state.solved.includes(match.id)) {
    const solved = [...state.solved, match.id];
    return {
      state: { ...state, solved, history: [...state.history, true] },
      accepted: true,
      correct: true,
      correctCategoryId: match.id,
    };
  }
  if (match && state.solved.includes(match.id)) {
    return { state, accepted: false, reason: "already" };
  }
  // wrong group -> mistake
  const mistakes = state.mistakes + 1;
  const playState = mistakes >= MISTAKE_BUDGET ? "lost" : state.playState;
  return {
    state: { ...state, mistakes, playState, history: [...state.history, false] },
    accepted: true,
    correct: false,
  };
}

/**
 * All GIVEN (non-ghost) categories solved? The ghost group's four words are then
 * whatever remains; the player names the ghost rather than submitting it as a
 * group, so completion is gated on the given categories only. (ghost naming still
 * required to win)
 */
export function allGroupsSolved(state: AttemptState, puzzle: Puzzle): boolean {
  const givenIds = puzzle.categories.filter((c) => !c.isGhost).map((c) => c.id);
  return givenIds.every((id) => state.solved.includes(id));
}

/**
 * REQ-011..013 — pick the ghost label. Only allowed once all groups are solved.
 * Correct pick -> won.
 */
export function pickGhostLabel(state: AttemptState, puzzle: Puzzle, label: string): AttemptState {
  if (state.playState !== "in_progress") return state;
  if (!allGroupsSolved(state, puzzle)) return state;
  if (!puzzle.ghostCandidates.includes(label)) return state;
  const correct = label === ghostCategory(puzzle).label;
  return {
    ...state,
    ghostPick: label,
    ghostCorrect: correct,
    playState: correct ? "won" : state.playState,
  };
}

export function canSubmit(state: AttemptState): boolean {
  return state.playState === "in_progress";
}
