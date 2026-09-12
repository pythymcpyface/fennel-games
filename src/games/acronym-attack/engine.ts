import type { AttemptState, Puzzle, ValidationResult } from "./types.ts";

// Pure Acronym Attack engine. No storage, no clock. Deterministic.

export function normalizeWord(raw: string): string {
  return raw.normalize("NFC").trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    words: new Array(puzzle.acronym.length).fill(""),
    status: "in_progress",
    submitCount: 0,
  };
}

export function setWord(state: AttemptState, index: number, raw: string): AttemptState {
  if (state.status !== "in_progress") return state;
  if (index < 0 || index >= state.words.length) return state;
  const words = [...state.words];
  words[index] = normalizeWord(raw);
  return { ...state, words };
}

/** Validate the full expansion: each word non-empty, starts with the acronym letter,
 *  and is a dictionary word. Score = sum of word lengths (elegance) when valid. */
export function validate(state: AttemptState, puzzle: Puzzle, dictionary: ReadonlySet<string>): ValidationResult {
  const perLetterOk: boolean[] = [];
  let allDictionary = true;
  let score = 0;
  for (let i = 0; i < puzzle.acronym.length; i++) {
    const w = state.words[i] ?? "";
    const startsRight = w.length > 0 && w[0] === puzzle.acronym[i];
    const inDict = dictionary.has(w);
    perLetterOk.push(startsRight);
    if (!inDict) allDictionary = false;
    if (startsRight && inDict) score += w.length;
  }
  const valid = perLetterOk.every(Boolean) && allDictionary;
  return { valid, perLetterOk, allDictionary, score: valid ? score : 0 };
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress";
}

export interface SubmitOutcome {
  state: AttemptState;
  result: ValidationResult;
}

export function submit(state: AttemptState, puzzle: Puzzle, dictionary: ReadonlySet<string>): SubmitOutcome {
  if (state.status !== "in_progress") return { state, result: validate(state, puzzle, dictionary) };
  const result = validate(state, puzzle, dictionary);
  const submitCount = state.submitCount + 1;
  const status = result.valid ? "won" : "in_progress";
  return { state: { ...state, submitCount, status }, result };
}
