import type { Answer, AttemptState, EventType, Puzzle, TraceResult } from "./types.ts";
import { COLS, ROWS, HINT_PER_FILLER } from "./types.ts";

// Pure Semantic Gradient engine. No storage, no clock, no DOM. Deterministic.
// Grid geometry + path matching mirror Edit-Ladder Trails (Strands family).

export function rowOf(cell: number): number { return Math.floor(cell / COLS); }
export function colOf(cell: number): number { return cell % COLS; }

export function areAdjacent(a: number, b: number): boolean {
  if (a === b) return false;
  return Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;
}

export function isValidPath(path: readonly number[]): boolean {
  if (path.length === 0) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (c < 0 || c >= ROWS * COLS) return false;
    if (seen.has(c)) return false;
    seen.add(c);
    if (i > 0 && !areAdjacent(path[i - 1], c)) return false;
  }
  return true;
}

function sameSeq(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Match a trace to an answer forward or reversed (Strands accepts either). */
export function matchAnswer(path: readonly number[], puzzle: Puzzle): Answer | null {
  if (!isValidPath(path)) return null;
  const rev = [...path].reverse();
  for (const a of puzzle.answers) if (sameSeq(path, a.path) || sameSeq(rev, a.path)) return a;
  return null;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, foundIds: [], hintBalance: 0, hintsSpent: 0, revealedIds: [], log: [], status: "in_progress" };
}

/** Won iff all theme answers + the spangram are found (fillers optional). */
export function isWon(state: AttemptState, puzzle: Puzzle): boolean {
  const need = puzzle.answers.filter((a) => a.type !== "filler").map((a) => a.id);
  const found = new Set(state.foundIds);
  return need.every((id) => found.has(id));
}

export function submitTrace(state: AttemptState, puzzle: Puzzle, path: readonly number[]): TraceResult {
  if (state.status !== "in_progress") return { state, found: null, error: null };
  if (path.length === 0) return { state, found: null, error: "empty" };
  const ans = matchAnswer(path, puzzle);
  if (!ans) return { state, found: null, error: "not_an_answer" };
  if (state.foundIds.includes(ans.id)) return { state, found: ans, error: "already_found" };

  const foundIds = [...state.foundIds, ans.id];
  const order = state.log.length + 1;
  const evType: EventType = ans.type === "spangram" ? "found_spangram" : ans.type === "theme" ? "found_theme" : "found_filler";
  const log = [...state.log, { type: evType, order, cluster: ans.cluster }];
  let hintBalance = state.hintBalance;
  if (ans.type === "filler") hintBalance += HINT_PER_FILLER;

  let next: AttemptState = { ...state, foundIds, hintBalance, log };
  if (isWon(next, puzzle)) next = { ...next, status: "won" };
  return { state: next, found: ans, error: null };
}

/** Deterministic hint target: unfound + unrevealed, theme→spangram→filler, stable id. */
export function hintTarget(state: AttemptState, puzzle: Puzzle): Answer | null {
  const found = new Set(state.foundIds);
  const revealed = new Set(state.revealedIds);
  const rank = (t: Answer["type"]): number => (t === "spangram" ? 0 : t === "theme" ? 1 : 2);
  const cands = puzzle.answers
    .filter((a) => !found.has(a.id) && !revealed.has(a.id))
    .sort((a, b) => rank(a.type) - rank(b.type) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return cands[0] ?? null;
}

export function canSpendHint(state: AttemptState): boolean {
  return state.status === "in_progress" && state.hintBalance > 0;
}

export function spendHint(state: AttemptState, puzzle: Puzzle): { state: AttemptState; revealed: Answer | null } {
  if (!canSpendHint(state)) return { state, revealed: null };
  const target = hintTarget(state, puzzle);
  if (!target) return { state, revealed: null };
  const next: AttemptState = {
    ...state,
    hintBalance: state.hintBalance - 1,
    hintsSpent: state.hintsSpent + 1,
    revealedIds: [...state.revealedIds, target.id],
    log: [...state.log, { type: "spend_hint", order: state.log.length + 1 }],
  };
  return { state: next, revealed: target };
}
