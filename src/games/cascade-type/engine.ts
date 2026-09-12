import type { AttemptState, Puzzle } from "./types.ts";

// Pure Cascade Type engine. No storage, no clock, no gravity timers. Turn-based:
// state changes only on submissions. Only the exposed row is clearable.

export function normalizeSubmission(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z]/g, "");
}

export function wordId(row: number, idx: number): string {
  return `${row}:${idx}`;
}

export function totalWords(puzzle: Puzzle): number {
  return puzzle.rows.reduce((n, r) => n + r.length, 0);
}

/** REQ-010/014 — do two words share at least one letter? */
export function sharesLetter(a: string, b: string): boolean {
  const set = new Set(a.toLowerCase());
  for (const ch of b.toLowerCase()) if (set.has(ch)) return true;
  return false;
}

/** REQ-016 — deterministic combo multiplier. */
export function comboMultiplier(combo: number): number {
  return 1 + 0.25 * combo;
}

/** Base points (REQ-009) = word length. */
export function basePoints(word: string): number {
  return word.length;
}

/** Adjacency bonus (REQ-015): half the word length (rounded up) when linked, else 0. */
export function adjacencyBonus(word: string, linked: boolean): number {
  return linked ? Math.ceil(word.length / 2) : 0;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    cleared: [],
    exposedRow: 0,
    lastWord: null,
    combo: 0,
    comboMax: 0,
    score: 0,
    isComplete: false,
  };
}

/** Clearable words in the exposed row that aren't cleared yet: [idx, word]. */
export function clearableWords(state: AttemptState, puzzle: Puzzle): Array<{ idx: number; word: string }> {
  if (state.exposedRow >= puzzle.rows.length) return [];
  const row = puzzle.rows[state.exposedRow];
  const clearedSet = new Set(state.cleared);
  return row
    .map((word, idx) => ({ idx, word }))
    .filter(({ idx }) => !clearedSet.has(wordId(state.exposedRow, idx)));
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  matched: boolean;
  linked?: boolean;
  gained?: number;
}

/**
 * REQ-004..020 — process a submission. Only clears an uncleared word in the
 * exposed row. Non-match / empty = no-op (no penalty). On clear: compute link vs
 * last word, base + adjacency bonus times the combo multiplier, update combo/max,
 * advance the exposed row if fully cleared, and set solved when all cleared.
 */
export function submit(state: AttemptState, puzzle: Puzzle, rawText: string): SubmitOutcome {
  if (state.isComplete) return { state, accepted: false, matched: false };
  const guess = normalizeSubmission(rawText);
  if (guess.length === 0) return { state, accepted: false, matched: false };

  const clearable = clearableWords(state, puzzle);
  const hit = clearable.find((c) => c.word.toLowerCase() === guess);
  if (!hit) return { state, accepted: false, matched: false };

  const linked = state.lastWord !== null && sharesLetter(state.lastWord, hit.word);
  const combo = linked ? state.combo + 1 : 0;
  const comboMax = Math.max(state.comboMax, combo);
  const base = basePoints(hit.word);
  const bonus = adjacencyBonus(hit.word, linked);
  const gained = Math.floor((base + bonus) * comboMultiplier(combo));

  const cleared = [...state.cleared, wordId(state.exposedRow, hit.idx)];

  // Advance exposed row if this row is now fully cleared.
  let exposedRow = state.exposedRow;
  const clearedSet = new Set(cleared);
  const rowFull = puzzle.rows[exposedRow].every((_w, i) => clearedSet.has(wordId(exposedRow, i)));
  if (rowFull) exposedRow += 1;

  const isComplete = cleared.length === totalWords(puzzle);

  const next: AttemptState = {
    ...state,
    cleared,
    exposedRow,
    lastWord: hit.word.toLowerCase(),
    combo,
    comboMax,
    score: state.score + gained,
    isComplete,
  };
  return { state: next, accepted: true, matched: true, linked, gained };
}

export function clearedCount(state: AttemptState): number {
  return state.cleared.length;
}
export function clearedFraction(state: AttemptState, puzzle: Puzzle): number {
  const t = totalWords(puzzle);
  return t > 0 ? state.cleared.length / t : 0;
}
export function isSolved(state: AttemptState): boolean {
  return state.isComplete;
}
