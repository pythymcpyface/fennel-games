import type { AttemptState, Coord, MatchType, Placement, Puzzle } from "./types.ts";

// Pure Undertow engine. No storage, no clock. Straight-line geometry, forward/
// reverse reading, target/decoy matching, mistake counting. The novel rule:
// targets match only when the selected letters are REVERSED; forward decoys are
// traps.

/** REQ-006 — the 8 straight-line unit steps. Returns null if endpoints aren't collinear. */
export function lineStep(start: Coord, end: Coord): { dr: number; dc: number; len: number } | null {
  const dr = end.row - start.row;
  const dc = end.col - start.col;
  if (dr === 0 && dc === 0) return null; // single cell (EDGE-001)
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  // Straight line if horizontal, vertical, or perfect diagonal.
  const straight = dr === 0 || dc === 0 || adr === adc;
  if (!straight) return null;
  const len = Math.max(adr, adc) + 1;
  const sr = dr === 0 ? 0 : dr / adr;
  const sc = dc === 0 ? 0 : dc / adc;
  return { dr: sr, dc: sc, len };
}

/** REQ-007 — the inclusive list of cells from start to end along a straight line. */
export function cellsBetween(start: Coord, end: Coord): Coord[] | null {
  const step = lineStep(start, end);
  if (step === null) return null;
  const cells: Coord[] = [];
  for (let i = 0; i < step.len; i++) {
    cells.push({ row: start.row + step.dr * i, col: start.col + step.dc * i });
  }
  return cells;
}

function inBounds(c: Coord, puzzle: Puzzle): boolean {
  return c.row >= 0 && c.row < puzzle.rows && c.col >= 0 && c.col < puzzle.cols;
}

/** REQ-008 — read grid letters along the cells in order. */
export function readForward(cells: readonly Coord[], puzzle: Puzzle): string {
  return cells.map((c) => puzzle.grid[c.row][c.col]).join("");
}

/** REQ-009 — reverse a string (locale-independent). */
export function reverse(s: string): string {
  return s.split("").reverse().join("");
}

/** A placement's canonical line key (A->B and B->A are identical; REQ-023 / EDGE-012). */
export function lineKey(p: Placement): string {
  const a = `${p.start.row},${p.start.col}`;
  const b = `${p.end.row},${p.end.col}`;
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, foundTargetIds: [], mistakeCount: 0, isComplete: false };
}

export interface Resolution {
  matchType: MatchType;
  /** the target id matched (TARGET_MATCH / ALREADY_FOUND). */
  targetId?: string;
}

/**
 * REQ-006..013 — resolve a selection line into a match outcome. Pure: does not
 * mutate state. The reversed reading is checked against targets; the forward
 * reading is checked against decoys.
 */
export function resolveSelection(state: AttemptState, puzzle: Puzzle, start: Coord, end: Coord): Resolution {
  if (!inBounds(start, puzzle) || !inBounds(end, puzzle)) return { matchType: "NO_MATCH" };
  const cells = cellsBetween(start, end);
  if (cells === null) return { matchType: "NO_MATCH" }; // REQ-006 non-collinear / single cell
  const forward = readForward(cells, puzzle);
  const reversed = reverse(forward);

  // REQ-010/013 — reversed reading matches a target?
  const target = puzzle.targets.find((t) => t.word === reversed);
  if (target) {
    if (state.foundTargetIds.includes(target.id)) return { matchType: "ALREADY_FOUND", targetId: target.id };
    return { matchType: "TARGET_MATCH", targetId: target.id };
  }
  // REQ-012 — forward reading matches a decoy? (a mistake)
  if (puzzle.decoys.some((d) => d.word === forward)) return { matchType: "DECOY_MATCH" };
  return { matchType: "NO_MATCH" };
}

export interface ApplyOutcome {
  state: AttemptState;
  resolution: Resolution;
}

/**
 * REQ-011/014/015 — apply a selection: record found targets, increment mistakes on
 * decoys, and mark complete when all targets are found. Locked once complete.
 */
export function applySelection(state: AttemptState, puzzle: Puzzle, start: Coord, end: Coord): ApplyOutcome {
  if (state.isComplete) return { state, resolution: { matchType: "NO_MATCH" } };
  const resolution = resolveSelection(state, puzzle, start, end);
  let next = state;
  if (resolution.matchType === "TARGET_MATCH" && resolution.targetId) {
    const foundTargetIds = [...state.foundTargetIds, resolution.targetId];
    next = { ...state, foundTargetIds, isComplete: foundTargetIds.length === puzzle.targets.length };
  } else if (resolution.matchType === "DECOY_MATCH") {
    next = { ...state, mistakeCount: state.mistakeCount + 1 };
  }
  return { state: next, resolution };
}

/** All targets found. */
export function allFound(state: AttemptState, puzzle: Puzzle): boolean {
  return state.foundTargetIds.length === puzzle.targets.length;
}

/** REQ-015 — solved = all targets found AND mistakes within budget. */
export function isSolved(state: AttemptState, puzzle: Puzzle): boolean {
  return allFound(state, puzzle) && state.mistakeCount <= puzzle.mistakeBudget;
}
