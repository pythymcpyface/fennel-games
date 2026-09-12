import type { AttemptState, ErrorCode, Puzzle, SubmissionResult, SubstitutionMap } from "./types.ts";
import { ATTEMPTS_TOTAL, DEFAULT_SUBSTITUTIONS, WORDS_COUNT } from "./types.ts";

// Pure Numeronym engine. No storage, no clock. Deterministic.

export function normalize(raw: string): string {
  return raw.normalize("NFC").trim().toUpperCase().replace(/[^A-Z]/g, "");
}

/**
 * Enumerate the numeronym encodings of an EXPANSION word by replacing any of its
 * substrings that equal a substitution expansion with the corresponding token.
 * Deterministic: applies at most one replacement per token occurrence, left to right,
 * and returns the set of reachable encodings (bounded). Used to verify a clue is a
 * valid encoding of the guess.
 */
export function encodings(expansion: string, map: SubstitutionMap = DEFAULT_SUBSTITUTIONS): Set<string> {
  // invert: expansion-substring -> token
  const rev: Array<[string, string]> = [];
  for (const [token, exps] of Object.entries(map)) for (const e of exps) rev.push([e, token]);
  // sort by length desc so longer sound-alikes match first deterministically
  rev.sort((a, b) => b[0].length - a[0].length || (a[0] < b[0] ? -1 : 1));

  const results = new Set<string>([expansion]);
  // Try replacing each occurrence of each expansion fragment (single pass per fragment).
  for (const [frag, token] of rev) {
    for (const base of [...results]) {
      let idx = base.indexOf(frag);
      while (idx !== -1) {
        results.add(base.slice(0, idx) + token + base.slice(idx + frag.length));
        idx = base.indexOf(frag, idx + 1);
      }
    }
  }
  return results;
}

/** REQ-007 — the clue must be one of the guess's valid encodings. */
export function encodingMatches(guess: string, clue: string, map: SubstitutionMap = DEFAULT_SUBSTITUTIONS): boolean {
  return encodings(guess, map).has(clue.toUpperCase());
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    solved: new Array(WORDS_COUNT).fill(false),
    attemptsRemaining: ATTEMPTS_TOTAL,
    status: "in_progress",
    revealedLengths: new Array(WORDS_COUNT).fill(0),
  };
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress";
}

/** REQ-005..018 — submit a guess for item `index`. */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  index: number,
  rawGuess: string,
  dictionary: ReadonlySet<string>,
  map: SubstitutionMap = DEFAULT_SUBSTITUTIONS,
): SubmissionResult {
  if (state.status !== "in_progress") return { state, correct: false, error: "no_attempts_remaining" };
  if (state.attemptsRemaining <= 0) return { state, correct: false, error: "no_attempts_remaining" };
  if (state.solved[index]) return { state, correct: false, error: "already_solved" };
  const guess = normalize(rawGuess);
  if (guess.length === 0) return { state, correct: false, error: "empty_guess" };

  const isDictionaryWord = dictionary.has(guess);
  const encMatch = encodingMatches(guess, puzzle.clues[index], map);
  const isAnswer = guess === puzzle.answers[index];

  if (isDictionaryWord && encMatch && isAnswer) {
    const solved = [...state.solved];
    solved[index] = true;
    const won = solved.every(Boolean);
    return { state: { ...state, solved, status: won ? "won" : "in_progress" }, correct: true, error: null };
  }

  // Determine error precedence: dictionary -> encoding -> wrong answer.
  let error: ErrorCode;
  if (!isDictionaryWord) error = "not_in_dictionary";
  else if (!encMatch) error = "encoding_mismatch";
  else error = "wrong_answer";

  const attemptsRemaining = state.attemptsRemaining - 1;
  const lost = attemptsRemaining <= 0;
  return {
    state: { ...state, attemptsRemaining, status: lost ? "lost" : "in_progress" },
    correct: false,
    error,
    isDictionaryWord,
    encodingMatches: encMatch,
  };
}

/** REQ-019 — hint reveals the length of the current answer. */
export function applyHint(state: AttemptState, puzzle: Puzzle, index: number): AttemptState | null {
  if (state.status !== "in_progress" || state.solved[index]) return null;
  const revealedLengths = [...state.revealedLengths];
  revealedLengths[index] = puzzle.answers[index].length;
  return { ...state, revealedLengths };
}
