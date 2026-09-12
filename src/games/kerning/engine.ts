import type { AttemptState, Puzzle, SubmissionFeedback } from "./types.ts";
import { ATTEMPT_LIMIT } from "./types.ts";

// Pure Kerning engine. No storage, no clock. Deterministic.

/** Convert a spaced phrase to (letterRun, mask). Build-time helper. */
export function phraseToMask(phrase: string): { letterRun: string; mask: boolean[] } {
  const tokens = phrase.trim().toUpperCase().split(/\s+/);
  const letterRun = tokens.join("");
  const mask = new Array(Math.max(0, letterRun.length - 1)).fill(false);
  let pos = 0;
  for (let t = 0; t < tokens.length - 1; t++) {
    pos += tokens[t].length;
    mask[pos - 1] = true;
  }
  return { letterRun, mask };
}

export function segmentToTokens(letterRun: string, mask: boolean[]): string[] {
  const tokens: string[] = [];
  let start = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) { tokens.push(letterRun.slice(start, i + 1)); start = i + 1; }
  }
  tokens.push(letterRun.slice(start));
  return tokens;
}

export function isExactMatch(candidate: boolean[], target: boolean[]): boolean {
  if (candidate.length !== target.length) return false;
  for (let i = 0; i < candidate.length; i++) if (candidate[i] !== target[i]) return false;
  return true;
}

export function correctBreakCount(candidate: boolean[], target: boolean[]): number {
  let n = 0;
  const len = Math.min(candidate.length, target.length);
  for (let i = 0; i < len; i++) if (candidate[i] && target[i]) n++;
  return n;
}

export function allTokensValid(letterRun: string, mask: boolean[], dictionary: ReadonlySet<string>): boolean {
  return segmentToTokens(letterRun, mask).every((t) => dictionary.has(t));
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    mask: [...puzzle.shownMask], // start from reading A
    attemptsUsed: 0,
    status: "in_progress",
    revealedGaps: [],
    history: [],
  };
}

export function toggleGap(state: AttemptState, gapIndex: number): AttemptState {
  if (state.status !== "in_progress") return state;
  if (gapIndex < 0 || gapIndex >= state.mask.length) return state;
  if (state.revealedGaps.includes(gapIndex)) return state; // locked-correct
  const mask = [...state.mask];
  mask[gapIndex] = !mask[gapIndex];
  return { ...state, mask };
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress";
}

export interface SubmitOutcome {
  state: AttemptState;
  solved: boolean;
  feedback?: SubmissionFeedback;
}

export function submit(state: AttemptState, puzzle: Puzzle, dictionary: ReadonlySet<string>): SubmitOutcome {
  if (state.status !== "in_progress") return { state, solved: false };
  if (isExactMatch(state.mask, puzzle.targetMask)) {
    return { state: { ...state, status: "won" }, solved: true };
  }
  const feedback: SubmissionFeedback = {
    correctBreakCount: correctBreakCount(state.mask, puzzle.targetMask),
    allTokensAreDictionaryWords: allTokensValid(puzzle.letterRun, state.mask, dictionary),
  };
  const attemptsUsed = state.attemptsUsed + 1;
  const status = attemptsUsed >= ATTEMPT_LIMIT ? "lost" : "in_progress";
  return { state: { ...state, attemptsUsed, status, history: [...state.history, feedback.correctBreakCount] }, solved: false, feedback };
}

/** REQ-018 — reveal the lowest unrevealed target break; set + lock it. */
export interface HintOutcome { state: AttemptState; gapIndex: number; }
export function applyHint(state: AttemptState, puzzle: Puzzle): HintOutcome | null {
  if (state.status !== "in_progress") return null;
  const revealed = new Set(state.revealedGaps);
  let gap = -1;
  for (let i = 0; i < puzzle.targetMask.length; i++) if (puzzle.targetMask[i] && !revealed.has(i)) { gap = i; break; }
  if (gap === -1) return null;
  const mask = [...state.mask];
  mask[gap] = true;
  return { state: { ...state, mask, revealedGaps: [...state.revealedGaps, gap] }, gapIndex: gap };
}
