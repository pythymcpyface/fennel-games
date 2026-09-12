import type { AttemptState, Puzzle, SubmissionFeedback } from "./types.ts";
import { ATTEMPTS_TOTAL, VOWELS, WORDS_COUNT } from "./types.ts";

// Pure Vowel Ghost engine. No storage, no clock. Deterministic.

/** REQ-004 — normalize: NFC, trim, uppercase, A–Z only. */
export function normalize(raw: string): string {
  return raw.normalize("NFC").trim().toUpperCase().replace(/[^A-Z]/g, "");
}

/** REQ-006 — remove all vowels (A,E,I,O,U); Y is not a vowel. */
export function stripVowels(word: string): string {
  let out = "";
  for (const ch of word) if (!VOWELS.has(ch)) out += ch;
  return out;
}

/** REQ-019 — 1-based index of the first vowel, or null if none. */
export function firstVowelPosition(word: string): number | null {
  for (let i = 0; i < word.length; i++) if (VOWELS.has(word[i])) return i + 1;
  return null;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    solved: new Array(WORDS_COUNT).fill(false),
    attemptsUsed: 0,
    status: "in_progress",
    hintUsed: new Array(WORDS_COUNT).fill(false),
  };
}

export function attemptsRemaining(state: AttemptState): number {
  return ATTEMPTS_TOTAL - state.attemptsUsed;
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress";
}

export interface SubmitOutcome {
  state: AttemptState;
  correct: boolean;
  feedback?: SubmissionFeedback;
  empty?: boolean;
  alreadySolved?: boolean;
}

/** REQ-005..017 — submit a guess for word `index`. */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  index: number,
  rawGuess: string,
  dictionary: ReadonlySet<string>,
): SubmitOutcome {
  if (state.status !== "in_progress") return { state, correct: false };
  if (index < 0 || index >= WORDS_COUNT) return { state, correct: false };
  if (state.solved[index]) return { state, correct: false, alreadySolved: true };
  const guess = normalize(rawGuess);
  if (guess.length === 0) return { state, correct: false, empty: true }; // REQ-011 no attempt

  const answer = puzzle.words[index];
  const skeleton = puzzle.skeletons[index];
  const isDictionaryWord = dictionary.has(guess);
  const isSkeletonMatch = stripVowels(guess) === skeleton;
  const isAnswer = guess === answer;

  if (isAnswer) {
    const solved = [...state.solved];
    solved[index] = true;
    const won = solved.every(Boolean);
    return { state: { ...state, solved, status: won ? "won" : "in_progress" }, correct: true };
  }

  const attemptsUsed = state.attemptsUsed + 1;
  const lost = attemptsUsed >= ATTEMPTS_TOTAL;
  return {
    state: { ...state, attemptsUsed, status: lost ? "lost" : "in_progress" },
    correct: false,
    feedback: { isDictionaryWord, isSkeletonMatch },
  };
}

/** REQ-019/020 — hint reveals the first vowel position; marks hint used. */
export interface HintOutcome {
  state: AttemptState;
  position: number | null;
}
export function applyHint(state: AttemptState, puzzle: Puzzle, index: number): HintOutcome | null {
  if (state.status !== "in_progress") return null;
  if (index < 0 || index >= WORDS_COUNT || state.solved[index]) return null;
  const hintUsed = [...state.hintUsed];
  hintUsed[index] = true;
  return { state: { ...state, hintUsed }, position: firstVowelPosition(puzzle.words[index]) };
}
