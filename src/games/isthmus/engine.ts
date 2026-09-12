import type { AttemptState, Coord, Puzzle, ValidationStatus } from "./types.ts";

// Pure Isthmus engine. No storage, no clock. Deterministic path/word validation.

/** TERM-006 — 8-way (Moore) adjacency, excluding identity. */
export function isAdjacent(a: Coord, b: Coord): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

/** FIELD-013 — the letters along a path, concatenated. */
export function spelledText(path: Coord[], grid: string[][]): string {
  return path.map((c) => grid[c.row][c.col]).join("");
}

/** REQ-006/007 — can this candidate extend the path? (adjacency + no reuse) */
export function canExtend(path: Coord[], next: Coord, rows: number, cols: number): boolean {
  if (next.row < 0 || next.col < 0 || next.row >= rows || next.col >= cols) return false;
  if (path.some((c) => sameCoord(c, next))) return false; // no reuse
  if (path.length === 0) return true;
  return isAdjacent(path[path.length - 1], next);
}

/** Append a tile if legal; otherwise return the state unchanged. */
export function extend(state: AttemptState, next: Coord, puzzle: Puzzle): AttemptState {
  if (state.isSolved) return state;
  if (!canExtend(state.path, next, puzzle.rows, puzzle.cols)) return state;
  return { ...state, path: [...state.path, next] };
}

/** Remove the last tile (backspace). */
export function undo(state: AttemptState): AttemptState {
  if (state.isSolved || state.path.length === 0) return state;
  return { ...state, path: state.path.slice(0, -1) };
}

export function clearPath(state: AttemptState): AttemptState {
  if (state.isSolved) return state;
  return { ...state, path: [] };
}

/** REQ-009 — first tile on top row (0) and last on bottom row (rows-1). */
export function isShoreToShore(path: Coord[], rows: number): boolean {
  if (path.length < 2) return false;
  return path[0].row === 0 && path[path.length - 1].row === rows - 1;
}

/** Classify the current path (for submit feedback). */
export function classify(
  path: Coord[],
  puzzle: Puzzle,
  dictionary: ReadonlySet<string>,
): ValidationStatus {
  if (path.length === 0) return "EMPTY";
  // adjacency + reuse already enforced at extend time; re-verify for safety.
  for (let i = 1; i < path.length; i++) {
    if (!isAdjacent(path[i - 1], path[i])) return "NOT_ADJACENT";
  }
  const seen = new Set(path.map((c) => `${c.row},${c.col}`));
  if (seen.size !== path.length) return "REUSED_TILE";
  if (!isShoreToShore(path, puzzle.rows)) return "NOT_SHORE_TO_SHORE";
  if (!dictionary.has(spelledText(path, puzzle.grid))) return "NOT_A_WORD";
  return "VALID";
}

export interface SubmitOutcome {
  state: AttemptState;
  status: ValidationStatus;
  word?: string;
}

/** REQ-013/014/015 — submit: classify, count attempt, mark solved on VALID. */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  dictionary: ReadonlySet<string>,
): SubmitOutcome {
  if (state.isSolved) return { state, status: "VALID" };
  const status = classify(state.path, puzzle, dictionary);
  const word = status === "VALID" ? spelledText(state.path, puzzle.grid) : undefined;
  // Track best valid word length even if not shore-to-shore? Only count VALID.
  const bestLen = status === "VALID" ? Math.max(state.bestLen, state.path.length) : state.bestLen;
  const next: AttemptState = {
    ...state,
    attempts: state.attempts + 1,
    isSolved: status === "VALID",
    bestLen,
  };
  return { state: next, status, word };
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, path: [], attempts: 0, isSolved: false, bestLen: 0 };
}

export function canSubmit(state: AttemptState): boolean {
  return !state.isSolved;
}
