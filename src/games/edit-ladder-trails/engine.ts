import type { Answer, AttemptState, EventType, Puzzle, TraceResult } from "./types.ts";
import { COLS, ROWS, HINT_PER_FILLER } from "./types.ts";

// Pure Edit-Ladder Trails engine. No storage, no clock, no DOM. Deterministic.

/** cellIndex -> {row,col} and back (FIELD-006). */
export function rowOf(cell: number): number { return Math.floor(cell / COLS); }
export function colOf(cell: number): number { return cell % COLS; }

/** REQ-006 — 8-neighbour (king-move) adjacency. */
export function areAdjacent(a: number, b: number): boolean {
  if (a === b) return false;
  const dr = Math.abs(rowOf(a) - rowOf(b));
  const dc = Math.abs(colOf(a) - colOf(b));
  return dr <= 1 && dc <= 1;
}

/** True iff `path` is a contiguous 8-neighbour chain of DISTINCT cells (REQ-006/007). */
export function isValidPath(path: readonly number[]): boolean {
  if (path.length === 0) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (c < 0 || c >= ROWS * COLS) return false;
    if (seen.has(c)) return false;           // REQ-007: no cell reuse within a trace
    seen.add(c);
    if (i > 0 && !areAdjacent(path[i - 1], c)) return false;
  }
  return true;
}

function sameSequence(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * REQ-009 (ADR-003) — a trace matches an answer iff its path equals the answer's
 * placement path FORWARD or REVERSED (Strands accepts either tracing direction).
 */
export function matchAnswer(path: readonly number[], puzzle: Puzzle): Answer | null {
  if (!isValidPath(path)) return null;
  const reversed = [...path].reverse();
  for (const ans of puzzle.answers) {
    if (sameSequence(path, ans.path) || sameSequence(reversed, ans.path)) return ans;
  }
  return null;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    foundIds: [],
    hintBalance: 0,
    hintsSpent: 0,
    revealedIds: [],
    log: [],
    status: "in_progress",
  };
}

/** REQ-015 — won iff all rungs + the spangram are found (fillers NOT required). */
export function isWon(state: AttemptState, puzzle: Puzzle): boolean {
  const themeIds = puzzle.answers.filter((a) => a.type !== "filler").map((a) => a.id);
  const found = new Set(state.foundIds);
  return themeIds.every((id) => found.has(id));
}

/**
 * Submit a traced path. On an exact (fwd/rev) match to an unfound answer, records
 * the discovery, awards a hint for fillers (REQ-011), logs the event, and updates
 * win status (REQ-015). Never penalises; there is no lose state.
 */
export function submitTrace(state: AttemptState, puzzle: Puzzle, path: readonly number[]): TraceResult {
  if (state.status !== "in_progress") return { state, found: null, error: null };
  if (path.length === 0) return { state, found: null, error: "empty" };
  const ans = matchAnswer(path, puzzle);
  if (!ans) return { state, found: null, error: "not_an_answer" };          // REQ-009 / ERROR-004 (no penalty)
  if (state.foundIds.includes(ans.id)) return { state, found: ans, error: "already_found" }; // REQ-010

  const foundIds = [...state.foundIds, ans.id];
  const order = state.log.length + 1;
  const evType: EventType = ans.type === "spangram" ? "found_spangram" : ans.type === "rung" ? "found_rung" : "found_filler";
  const log = [...state.log, { type: evType, order }];
  let hintBalance = state.hintBalance;
  if (ans.type === "filler") hintBalance += HINT_PER_FILLER;               // REQ-011

  let next: AttemptState = { ...state, foundIds, hintBalance, log };
  if (isWon(next, puzzle)) next = { ...next, status: "won" };              // REQ-015
  return { state: next, found: ans, error: null };
}

/**
 * REQ-014 — deterministic hint target: the first UNFOUND, not-yet-revealed answer,
 * preferring theme answers (spangram, then rungs) over fillers, tie-broken by the
 * stable answer order in the pack. Returns null if none remain.
 */
export function hintTarget(state: AttemptState, puzzle: Puzzle): Answer | null {
  const found = new Set(state.foundIds);
  const revealed = new Set(state.revealedIds);
  const rank = (t: Answer["type"]): number => (t === "spangram" ? 0 : t === "rung" ? 1 : 2);
  const candidates = puzzle.answers
    .filter((a) => !found.has(a.id) && !revealed.has(a.id))
    .sort((a, b) => rank(a.type) - rank(b.type) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return candidates[0] ?? null;
}

export function canSpendHint(state: AttemptState): boolean {
  return state.status === "in_progress" && state.hintBalance > 0;          // REQ-012
}

/**
 * REQ-013 — spend one hint to reveal a target answer's START cell (no letters
 * leaked). Decrements balance, logs the spend, marks the answer revealed. If no
 * valid target remains (ERROR-005), the hint is NOT consumed.
 */
export function spendHint(state: AttemptState, puzzle: Puzzle): { state: AttemptState; revealed: Answer | null } {
  if (!canSpendHint(state)) return { state, revealed: null };
  const target = hintTarget(state, puzzle);
  if (!target) return { state, revealed: null };                           // ERROR-005: don't consume
  const next: AttemptState = {
    ...state,
    hintBalance: state.hintBalance - 1,
    hintsSpent: state.hintsSpent + 1,
    revealedIds: [...state.revealedIds, target.id],
    log: [...state.log, { type: "spend_hint", order: state.log.length + 1 }],
  };
  return { state: next, revealed: target };
}
