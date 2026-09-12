import type { AttemptState, ErrorCode, MoveResult, Puzzle } from "./types.ts";

// Pure Tradeoff engine. No storage, no clock. Deterministic.

/** Standard Scrabble (English) letter values. Shipped in each pack for determinism. */
export const SCRABBLE_VALUES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

export function normalizeWord(raw: string): string {
  return raw.normalize("NFC").trim().toUpperCase().replace(/[^A-Z]/g, "");
}

/** REQ-013 — word score = sum of letter values. */
export function scoreWord(word: string, values: Record<string, number>): number {
  let s = 0;
  for (const ch of word) s += values[ch] ?? 0;
  return s;
}

/** TERM-005 — exactly one position differs, same length. */
export function isOneLetterChange(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff === 1;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    currentWord: puzzle.startWord,
    swapsUsed: 0,
    moveHistory: [puzzle.startWord],
    bestScore: scoreWord(puzzle.startWord, puzzle.letterValues),
    winState: "in_progress",
    hintUsedCount: 0,
  };
}

function isDictionaryWord(word: string, puzzle: Puzzle): boolean {
  // A word is legal iff it appears as a node in the neighbor graph (built from the
  // curated dictionary) — this keeps the pack self-contained.
  return word === puzzle.startWord || puzzle.neighbors[word] !== undefined;
}

/** REQ-005..016 — submit a swap. */
export function submitMove(state: AttemptState, puzzle: Puzzle, rawInput: string): MoveResult {
  if (state.winState !== "in_progress") return fail(state, "ALREADY_ENDED");
  if (state.swapsUsed >= puzzle.swapBudget) return fail(state, "OUT_OF_SWAPS");
  const word = normalizeWord(rawInput);
  if (word.length !== state.currentWord.length) return fail(state, "WRONG_LENGTH");
  if (!isOneLetterChange(word, state.currentWord)) return fail(state, "NOT_ONE_LETTER_CHANGE");
  if (!isDictionaryWord(word, puzzle)) return fail(state, "NOT_IN_DICTIONARY");

  const swapsUsed = state.swapsUsed + 1;
  const currentWord = word;
  const score = scoreWord(currentWord, puzzle.letterValues);
  const bestScore = Math.max(state.bestScore, score);
  const moveHistory = [...state.moveHistory, currentWord];
  let winState: AttemptState["winState"] = "in_progress";
  if (score >= puzzle.parScore) winState = "won";
  else if (swapsUsed >= puzzle.swapBudget) winState = "lost";
  return { ok: true, state: { ...state, currentWord, swapsUsed, moveHistory, bestScore, winState } };
}

export function currentScore(state: AttemptState, puzzle: Puzzle): number {
  return scoreWord(state.currentWord, puzzle.letterValues);
}

/** REQ-017/018 — a score-improving neighbor (lowest lexicographically for determinism). */
export function findHint(state: AttemptState, puzzle: Puzzle): string | null {
  if (state.winState !== "in_progress") return null;
  const cur = currentScore(state, puzzle);
  const improving = (puzzle.neighbors[state.currentWord] ?? [])
    .filter((w) => scoreWord(w, puzzle.letterValues) > cur)
    .sort();
  return improving.length > 0 ? improving[0] : null;
}

function fail(state: AttemptState, error: ErrorCode): MoveResult {
  return { ok: false, error, state };
}
