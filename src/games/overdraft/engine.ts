import type { AttemptState, Evaluation, Puzzle } from "./types.ts";

// Pure Overdraft engine. No storage, no clock. Borrow accounting + scoring.

export function isWellFormed(word: string): boolean {
  return /^[A-Za-z]+$/.test(word.trim());
}

export function normalize(word: string): string {
  return word.trim().toUpperCase();
}

/**
 * REQ-007 — borrowed letters are those not present in the letter set. The set is
 * treated as a SET (reuse of in-set letters is free); each DISTINCT out-of-set
 * letter position counts. We count per-occurrence of an out-of-set letter.
 */
export function borrowedLetters(word: string, letterSet: readonly string[]): string[] {
  const inSet = new Set(letterSet.map((c) => c.toUpperCase()));
  const out: string[] = [];
  for (const ch of normalize(word)) {
    if (!inSet.has(ch)) out.push(ch);
  }
  return out;
}

/** REQ-010/011 — base score by configured method. */
export function baseScore(word: string, puzzle: Puzzle): number {
  const w = normalize(word);
  if (puzzle.scoringMethod === "LENGTH") return w.length;
  let sum = 0;
  for (const ch of w) sum += puzzle.letterPoints[ch] ?? 0;
  return sum;
}

/** REQ-007..015 — full evaluation of a candidate word (pure, no dictionary I/O). */
export function evaluate(word: string, puzzle: Puzzle, dictionary: ReadonlySet<string>): Evaluation {
  const w = normalize(word);
  const borrowed = borrowedLetters(w, puzzle.letterSet);
  const base = baseScore(w, puzzle);
  const penalty = borrowed.length * puzzle.borrowPenalty;
  return {
    word: w,
    borrowedLetters: borrowed,
    borrowedCount: borrowed.length,
    baseScore: base,
    penalty,
    netScore: base - penalty,
    overLimit: borrowed.length > puzzle.maxBorrow,
    inDictionary: dictionary.has(w),
  };
}

/** REQ-008/014 — is a candidate submittable? (well-formed, in dict, within borrow limit) */
export function canSubmitWord(word: string, puzzle: Puzzle, dictionary: ReadonlySet<string>): boolean {
  if (!isWellFormed(word)) return false;
  const ev = evaluate(word, puzzle, dictionary);
  return ev.inDictionary && !ev.overLimit;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, finalWord: "", netScore: 0, borrowedCount: 0, isComplete: false };
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "well-formed" | "dictionary" | "over-limit" | "complete";
  evaluation?: Evaluation;
}

/** REQ-015..017 — finalize exactly one word for the day. */
export function submit(state: AttemptState, puzzle: Puzzle, dictionary: ReadonlySet<string>, word: string): SubmitOutcome {
  if (state.isComplete) return { state, accepted: false, reason: "complete" };
  if (!isWellFormed(word)) return { state, accepted: false, reason: "well-formed" };
  const ev = evaluate(word, puzzle, dictionary);
  if (!ev.inDictionary) return { state, accepted: false, reason: "dictionary" };
  if (ev.overLimit) return { state, accepted: false, reason: "over-limit" };
  return {
    state: { ...state, finalWord: ev.word, netScore: ev.netScore, borrowedCount: ev.borrowedCount, isComplete: true },
    accepted: true,
    evaluation: ev,
  };
}

export function canSubmit(state: AttemptState): boolean {
  return !state.isComplete;
}
