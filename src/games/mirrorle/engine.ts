import type { AttemptState, FeedbackRow, Puzzle } from "./types.ts";
import { GUESS_BUDGET, MAX_GREEN, WORD_LEN } from "./types.ts";

// Pure Mirrorle engine (TERM-011 Letter Accounting Rule). No storage, no clock.
// Deterministic across WKWebView / Android WebView / browsers (NFR cross-platform).

/**
 * Wordle-style two-pass green/yellow count for ONE guess against ONE secret.
 * Pass 1: greens (exact position). Pass 2: yellows from remaining secret letters,
 * respecting letter multiplicity. Returns per-secret {green, yellow}.
 * REQ-011/012, EDGE-003 (duplicate letters).
 */
export function scoreOne(guess: string, secret: string): { green: number; yellow: number } {
  const g = guess.toUpperCase();
  const s = secret.toUpperCase();
  let green = 0;
  // Remaining secret-letter pool after removing greens, for yellow accounting.
  const pool = new Map<string, number>();
  const usedGreen = new Array(WORD_LEN).fill(false);
  for (let i = 0; i < WORD_LEN; i++) {
    if (g[i] === s[i]) {
      green++;
      usedGreen[i] = true;
    } else {
      pool.set(s[i], (pool.get(s[i]) ?? 0) + 1);
    }
  }
  let yellow = 0;
  for (let i = 0; i < WORD_LEN; i++) {
    if (usedGreen[i]) continue;
    const c = g[i];
    const avail = pool.get(c) ?? 0;
    if (avail > 0) {
      yellow++;
      pool.set(c, avail - 1);
    }
  }
  return { green, yellow };
}

/**
 * REQ-011/012 — aggregated feedback: sum greens and yellows across BOTH secrets.
 * The player never learns which secret contributed which — that is the mechanic.
 */
export function scoreGuess(guess: string, puzzle: Puzzle): FeedbackRow {
  const a = scoreOne(guess, puzzle.secretA);
  const b = scoreOne(guess, puzzle.secretB);
  return {
    guess: guess.toUpperCase(),
    green: a.green + b.green,
    yellow: a.yellow + b.yellow,
  };
}

/** REQ-007 — fresh attempt. */
export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, rows: [], isSolved: false, isFailed: false };
}

/** FIELD-013 — normalize + validate a guess is exactly 5 letters (REQ-008). */
export function isWellFormed(guess: string): boolean {
  return /^[A-Za-z]{5}$/.test(guess.trim());
}

/** REQ-009 — is the guess a real word in the guess list? */
export function isValidGuess(guess: string, dictionary: ReadonlySet<string>): boolean {
  return isWellFormed(guess) && dictionary.has(guess.trim().toUpperCase());
}

/** REQ-016 — can the player still submit? */
export function canSubmit(state: AttemptState): boolean {
  return !state.isSolved && !state.isFailed && state.rows.length < GUESS_BUDGET;
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "well-formed" | "dictionary" | "terminal" | "duplicate";
  row?: FeedbackRow;
  solved?: boolean;
}

/**
 * REQ-008..016 — validate, score, append, and evaluate win/lose.
 * Win condition: every secret has been individually solved (a per-secret green of
 * WORD_LEN by some guess). Because feedback is aggregated, the player must land a
 * full-green guess on EACH secret across their attempts — that is the mechanic.
 */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  dictionary: ReadonlySet<string>,
  guess: string,
): SubmitOutcome {
  if (!canSubmit(state)) return { state, accepted: false, reason: "terminal" };
  if (!isWellFormed(guess)) return { state, accepted: false, reason: "well-formed" };
  const norm = guess.trim().toUpperCase();
  if (!dictionary.has(norm)) return { state, accepted: false, reason: "dictionary" };
  if (state.rows.some((r) => r.guess === norm)) return { state, accepted: false, reason: "duplicate" };

  const row = scoreGuess(norm, puzzle);
  const rows = [...state.rows, row];

  // Win: both secrets have each been solved by some guess (per-secret full green).
  const solvedA = rows.some((r) => scoreOne(r.guess, puzzle.secretA).green === WORD_LEN);
  const solvedB = rows.some((r) => scoreOne(r.guess, puzzle.secretB).green === WORD_LEN);
  const isSolved = solvedA && solvedB;
  const isFailed = !isSolved && rows.length >= GUESS_BUDGET;
  return {
    state: { ...state, rows, isSolved, isFailed },
    accepted: true,
    row,
    solved: isSolved,
  };
}

export { MAX_GREEN };
