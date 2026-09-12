import type { Coord, DistanceMetric, Puzzle, Target } from "./types.ts";
import { targetCells, readForward } from "./engine.ts";

// Build-time content generation + fairness gate for Fogline (TERM-024). Pure +
// deterministic. Validates that each target reads forward along its line, grid
// dimensions are consistent, word length equals the span, and at least one
// target is fully within the seed reveal (solvable-from-seed, TERM-025).

export interface RawTarget {
  id: string;
  word: string;
  start: Coord;
  dir: Coord;
}

export interface RawPuzzle {
  rows: number;
  cols: number;
  grid: string[];
  targets: RawTarget[];
  seedCells: Coord[];
  fogRevealRadius: number;
  distanceMetric?: DistanceMetric;
}

export function norm(s: string): string {
  return s.trim().toUpperCase();
}

function gridView(raw: RawPuzzle): Puzzle {
  return {
    puzzleId: "",
    rows: raw.rows,
    cols: raw.cols,
    grid: raw.grid,
    targets: [],
    seedCells: [],
    fogRevealRadius: raw.fogRevealRadius,
    distanceMetric: raw.distanceMetric ?? "CHEBYSHEV",
  };
}

function toTarget(t: RawTarget): Target {
  return { id: t.id, word: norm(t.word), start: t.start, dir: t.dir };
}

/** Fairness gate (REQ-014..016). Returns failure reasons; empty = fair. */
export function validate(raw: RawPuzzle): string[] {
  const reasons: string[] = [];

  // REQ-015 — grid dimensions consistent.
  if (raw.grid.length !== raw.rows) reasons.push(`grid has ${raw.grid.length} rows, expected ${raw.rows}`);
  if (raw.grid.some((r) => r.length !== raw.cols)) reasons.push(`not all rows have ${raw.cols} cols`);
  if (raw.grid.some((r) => !/^[A-Z]+$/.test(r))) reasons.push("grid must be uppercase A-Z");
  if (raw.fogRevealRadius < 0) reasons.push("fogRevealRadius must be >= 0");
  if (reasons.length > 0) return reasons;

  const view = gridView(raw);
  const inb = (c: Coord) => c.row >= 0 && c.row < raw.rows && c.col >= 0 && c.col < raw.cols;
  const seedSet = new Set(raw.seedCells.map((c) => `${c.row},${c.col}`));

  let anySolvable = false;
  for (const rt of raw.targets) {
    const t = toTarget(rt);
    const isDir = (rt.dir.row !== 0 || rt.dir.col !== 0) && Math.abs(rt.dir.row) <= 1 && Math.abs(rt.dir.col) <= 1;
    if (!isDir) { reasons.push(`target ${t.id}: invalid direction`); continue; }
    const cells = targetCells(t);
    if (cells.some((c) => !inb(c))) { reasons.push(`target ${t.id}: extends out of bounds`); continue; }
    // REQ-014 — reads forward along its line.
    if (readForward(cells, view) !== t.word) reasons.push(`target ${t.id}: does not read forward along its line`);
    // REQ-016 — solvable from seed: all cells within the seed reveal.
    if (cells.every((c) => seedSet.has(`${c.row},${c.col}`))) anySolvable = true;
  }

  const ids = raw.targets.map((t) => t.id);
  if (new Set(ids).size !== ids.length) reasons.push("duplicate target id");
  if (raw.targets.length < 1) reasons.push("puzzle has no targets");
  if (raw.seedCells.some((c) => !inb(c))) reasons.push("seed cell out of bounds");
  if (!anySolvable) reasons.push("no initially selectable target (not solvable from seed)");

  return reasons;
}

export function buildPuzzle(puzzleId: string, raw: RawPuzzle): Puzzle | null {
  if (validate(raw).length > 0) return null;
  return {
    puzzleId,
    rows: raw.rows,
    cols: raw.cols,
    grid: raw.grid.slice(),
    targets: raw.targets.map(toTarget),
    seedCells: raw.seedCells.map((c) => ({ ...c })),
    fogRevealRadius: raw.fogRevealRadius,
    distanceMetric: raw.distanceMetric ?? "CHEBYSHEV",
  };
}

export function assertPuzzleValid(raw: RawPuzzle): void {
  const reasons = validate(raw);
  if (reasons.length > 0) throw new Error(`fogline invalid puzzle:\n - ${reasons.join("\n - ")}`);
}
