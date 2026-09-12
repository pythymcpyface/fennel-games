import type { AttemptState, GuessRecord, Puzzle, SubmissionFeedback } from "./types.ts";
import { MAX_INCORRECT_ATTEMPTS } from "./types.ts";

// Pure Hidden Middle engine (TERM-018). No storage, no clock.

/** REQ-006 — normalize: NFC, trim, uppercase, A–Z only. */
export function normalizeGuess(raw: string): string {
  return raw.normalize("NFC").trim().toUpperCase().replace(/[^A-Z]/g, "");
}

/** REQ-007 — is the guess a contiguous substring of the carrier? */
export function isSubstringOf(guess: string, carrier: string): boolean {
  return guess.length > 0 && carrier.includes(guess);
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    status: "in_progress",
    incorrectAttemptsUsed: 0,
    guessHistory: [],
    hintRevealed: false,
  };
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress";
}

export interface SubmitOutcome {
  state: AttemptState;
  result: GuessRecord["result"];
  feedback?: SubmissionFeedback;
}

/**
 * REQ-004..016 — submit a guess. Empty → EMPTY no-op. Duplicate → DUPLICATE no-op
 * (does not consume an attempt, REQ-016). Correct (substring + dict + intended) →
 * SOLVED. Incorrect → feedback + consume attempt, FAILED on limit.
 */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  rawGuess: string,
  dictionary: ReadonlySet<string>,
): SubmitOutcome {
  if (state.status !== "in_progress") return { state, result: "EMPTY" };
  const guess = normalizeGuess(rawGuess);
  if (guess.length === 0) return { state, result: "EMPTY" };
  if (state.guessHistory.some((g) => g.guess === guess)) return { state, result: "DUPLICATE" };

  const isSub = isSubstringOf(guess, puzzle.carrierWord);
  const isWord = dictionary.has(guess);
  const isAnswer = guess === puzzle.answerWord;

  if (isAnswer) {
    const record: GuessRecord = { guess, isSubstring: true, isDictionaryWord: true, result: "CORRECT" };
    return { state: { ...state, status: "solved", guessHistory: [...state.guessHistory, record] }, result: "CORRECT" };
  }

  const record: GuessRecord = { guess, isSubstring: isSub, isDictionaryWord: isWord, result: "INCORRECT" };
  const incorrectAttemptsUsed = state.incorrectAttemptsUsed + 1;
  const status = incorrectAttemptsUsed >= MAX_INCORRECT_ATTEMPTS ? "failed" : "in_progress";
  return {
    state: { ...state, status, incorrectAttemptsUsed, guessHistory: [...state.guessHistory, record] },
    result: "INCORRECT",
    feedback: { isSubstring: isSub, isDictionaryWord: isWord },
  };
}
