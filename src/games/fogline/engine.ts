import type { AttemptState, Coord, MatchType, Puzzle, Target } from "./types.ts";

// Pure Fogline engine. No storage, no clock. Straight-line geometry, fog masking,
// progressive reveal on find. The novel rule: you can only select cells that are
// currently revealed; each find lifts fog around the found word.

/** REQ-005 — the 8 straight-line unit steps. Returns null if not collinear/single. */
export function lineStep(start: Coord, end: Coord): { dr: number; dc: number; len: number } | null {
  const dr = end.row - start.row;
  const dc = end.col - start.col;
  if (dr === 0 && dc === 0) return null;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  if (!(dr === 0 || dc === 0 || adr === adc)) return null;
  const len = Math.max(adr, adc) + 1;
  return { dr: dr === 0 ? 0 : dr / adr, dc: dc === 0 ? 0 : dc / adc, len };
}

export function cellsBetween(start: Coord, end: Coord): Coord[] | null {
  const step = lineStep(start, end);
  if (step === null) return null;
  const cells: Coord[] = [];
  for (let i = 0; i < step.len; i++) cells.push({ row: start.row + step.dr * i, col: start.col + step.dc * i });
  return cells;
}

/** The cells a target occupies (start + dir * i). */
export function targetCells(t: Target): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < t.word.length; i++) cells.push({ row: t.start.row + t.dir.row * i, col: t.start.col + t.dir.col * i });
  return cells;
}

export function idx(c: Coord, puzzle: Puzzle): number {
  return c.row * puzzle.cols + c.col;
}
function inBounds(c: Coord, puzzle: Puzzle): boolean {
  return c.row >= 0 && c.row < puzzle.rows && c.col >= 0 && c.col < puzzle.cols;
}

export function readForward(cells: readonly Coord[], puzzle: Puzzle): string {
  return cells.map((c) => puzzle.grid[c.row][c.col]).join("");
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  const revealed = new Array<boolean>(puzzle.rows * puzzle.cols).fill(false);
  for (const c of puzzle.seedCells) if (inBounds(c, puzzle)) revealed[idx(c, puzzle)] = true;
  return { puzzleId: puzzle.puzzleId, dayId, revealed, foundTargetIds: [], selectionCount: 0, isComplete: false };
}

export function isRevealed(state: AttemptState, puzzle: Puzzle, c: Coord): boolean {
  return inBounds(c, puzzle) && state.revealed[idx(c, puzzle)] === true;
}

/** REQ-009 / TERM-021 — distance within radius under the puzzle's metric. */
export function withinRadius(a: Coord, b: Coord, radius: number, metric: Puzzle["distanceMetric"]): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  const d = metric === "MANHATTAN" ? dr + dc : Math.max(dr, dc);
  return d <= radius;
}

export interface Resolution {
  matchType: MatchType;
  targetId?: string;
}

/**
 * REQ-004..008 — resolve a selection (pure, no mutation). Blocked if any cell is
 * fogged. Otherwise matches an unfound target whose forward reading equals the
 * selected letters AND whose cells equal the selection.
 */
export function resolveSelection(state: AttemptState, puzzle: Puzzle, start: Coord, end: Coord): Resolution {
  if (!inBounds(start, puzzle) || !inBounds(end, puzzle)) return { matchType: "NO_MATCH" };
  const cells = cellsBetween(start, end);
  if (cells === null) return { matchType: "NO_MATCH" };
  // REQ-004 — cannot select into the fog.
  if (cells.some((c) => !isRevealed(state, puzzle, c))) return { matchType: "BLOCKED_BY_FOG" };

  const word = readForward(cells, puzzle);
  const key = (cs: Coord[]) => cs.map((c) => `${c.row},${c.col}`).join(">");
  const selKey = key(cells);
  const match = puzzle.targets.find((t) => t.word === word && key(targetCells(t)) === selKey);
  if (match) {
    if (state.foundTargetIds.includes(match.id)) return { matchType: "ALREADY_FOUND", targetId: match.id };
    return { matchType: "FOUND", targetId: match.id };
  }
  return { matchType: "NO_MATCH" };
}

export interface ApplyOutcome {
  state: AttemptState;
  resolution: Resolution;
}

/**
 * REQ-006..010 — apply a selection: fog-blocked selections do NOT count; any
 * accepted (revealed, collinear) selection increments the count; a FOUND target
 * is recorded and the fog recedes around it. Completes when all found.
 */
export function applySelection(state: AttemptState, puzzle: Puzzle, start: Coord, end: Coord): ApplyOutcome {
  if (state.isComplete) return { state, resolution: { matchType: "NO_MATCH" } };
  const resolution = resolveSelection(state, puzzle, start, end);
  if (resolution.matchType === "BLOCKED_BY_FOG") return { state, resolution }; // REQ-004: no count change

  let next: AttemptState = { ...state, selectionCount: state.selectionCount + 1 };
  if (resolution.matchType === "FOUND" && resolution.targetId) {
    const target = puzzle.targets.find((t) => t.id === resolution.targetId)!;
    const revealed = next.revealed.slice();
    revealTargetNeighborhood(revealed, puzzle, target);
    const foundTargetIds = [...next.foundTargetIds, target.id];
    next = { ...next, revealed, foundTargetIds, isComplete: foundTargetIds.length === puzzle.targets.length };
  }
  return { state: next, resolution };
}

/** REQ-009 — reveal all cells within fogRevealRadius of any target cell. */
export function revealTargetNeighborhood(revealed: boolean[], puzzle: Puzzle, target: Target): void {
  const cells = targetCells(target);
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const here = { row: r, col: c };
      if (cells.some((tc) => withinRadius(tc, here, puzzle.fogRevealRadius, puzzle.distanceMetric))) {
        revealed[idx(here, puzzle)] = true;
      }
    }
  }
}

export function isSolved(state: AttemptState, puzzle: Puzzle): boolean {
  return state.foundTargetIds.length === puzzle.targets.length;
}
