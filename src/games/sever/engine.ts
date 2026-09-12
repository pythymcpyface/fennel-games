import type { AttemptState, Puzzle, SubmissionFeedback } from "./types.ts";
import { ATTEMPT_LIMIT } from "./types.ts";

// Pure segmentation engine (TERM-026). No storage, no clock. Deterministic string
// operations identical across platforms.

/** Convert a spaced phrase to (puzzleString, intendedBreaks). Build-time helper. */
export function phraseToBreaks(phrase: string): { puzzleString: string; intendedBreaks: boolean[] } {
  const tokens = phrase.trim().toUpperCase().split(/\s+/);
  const puzzleString = tokens.join("");
  const breaks = new Array(Math.max(0, puzzleString.length - 1)).fill(false);
  let pos = 0;
  for (let t = 0; t < tokens.length - 1; t++) {
    pos += tokens[t].length;
    breaks[pos - 1] = true; // gap after the token's last letter
  }
  return { puzzleString, intendedBreaks: breaks };
}

/** Apply a break array to a string, producing tokens (TERM-005). */
export function segmentToTokens(puzzleString: string, breaks: boolean[]): string[] {
  const tokens: string[] = [];
  let start = 0;
  for (let i = 0; i < breaks.length; i++) {
    if (breaks[i]) {
      tokens.push(puzzleString.slice(start, i + 1));
      start = i + 1;
    }
  }
  tokens.push(puzzleString.slice(start));
  return tokens;
}

/** REQ-008 — exact segmentation match. */
export function isExactMatch(candidate: boolean[], intended: boolean[]): boolean {
  if (candidate.length !== intended.length) return false;
  for (let i = 0; i < candidate.length; i++) if (candidate[i] !== intended[i]) return false;
  return true;
}

/** REQ-011 — count break positions correct in both candidate and intended (true∧true). */
export function correctBreakCount(candidate: boolean[], intended: boolean[]): number {
  let n = 0;
  const len = Math.min(candidate.length, intended.length);
  for (let i = 0; i < len; i++) if (candidate[i] && intended[i]) n++;
  return n;
}

/** REQ-012 — every produced token is a dictionary word. */
export function allTokensValid(
  puzzleString: string,
  breaks: boolean[],
  dictionary: ReadonlySet<string>,
): boolean {
  return segmentToTokens(puzzleString, breaks).every((t) => dictionary.has(t));
}

/** REQ-005 — fresh attempt. */
export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    breaks: new Array(puzzle.intendedBreaks.length).fill(false),
    attemptsUsed: 0,
    isSolved: false,
    isFailed: false,
    revealedBreaks: [],
    hintUsedCount: 0,
    history: [],
  };
}

/** REQ-006/007 — toggle a gap unless solved/failed or the gap is a locked reveal. */
export function toggleBreak(state: AttemptState, gapIndex: number): AttemptState {
  if (state.isSolved || state.isFailed) return state;
  if (gapIndex < 0 || gapIndex >= state.breaks.length) return state;
  if (state.revealedBreaks.includes(gapIndex)) return state; // locked-correct
  const breaks = [...state.breaks];
  breaks[gapIndex] = !breaks[gapIndex];
  return { ...state, breaks };
}

export interface SubmitOutcome {
  state: AttemptState;
  solved: boolean;
  feedback?: SubmissionFeedback;
}

/** REQ-008..013/017 — submit the candidate; solve or consume an attempt. */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  dictionary: ReadonlySet<string>,
): SubmitOutcome {
  if (state.isSolved || state.isFailed) return { state, solved: false };
  if (state.attemptsUsed >= ATTEMPT_LIMIT) return { state, solved: false };

  if (isExactMatch(state.breaks, puzzle.intendedBreaks)) {
    return { state: { ...state, isSolved: true }, solved: true };
  }
  const feedback: SubmissionFeedback = {
    correctBreakCount: correctBreakCount(state.breaks, puzzle.intendedBreaks),
    allTokensAreDictionaryWords: allTokensValid(puzzle.puzzleString, state.breaks, dictionary),
  };
  const attemptsUsed = state.attemptsUsed + 1;
  const isFailed = attemptsUsed >= ATTEMPT_LIMIT;
  return {
    state: { ...state, attemptsUsed, isFailed, history: [...state.history, feedback] },
    solved: false,
    feedback,
  };
}

export function canSubmit(state: AttemptState): boolean {
  return !state.isSolved && !state.isFailed && state.attemptsUsed < ATTEMPT_LIMIT;
}
