import type { Placement, Puzzle } from "./types.ts";
import { cellsBetween, readForward, reverse, lineKey } from "./engine.ts";

// Build-time content generation + fairness gate for Undertow (TERM-019). Pure +
// deterministic. Given a grid + target placements (which must read REVERSED along
// their lines) + decoy placements (which must read FORWARD), the gate proves the
// puzzle is consistent and fair.

export interface RawPlacement {
  id: string;
  word: string;
  start: { row: number; col: number };
  end: { row: number; col: number };
}

export interface RawPuzzle {
  rows: number;
  cols: number;
  grid: string[];
  targets: RawPlacement[];
  decoys: RawPlacement[];
  mistakeBudget?: number;
}

export function norm(s: string): string {
  return s.trim().toUpperCase();
}

/** A minimal Puzzle view for the geometry helpers (only grid + dims needed). */
function gridView(raw: RawPuzzle): Puzzle {
  return { puzzleId: "", rows: raw.rows, cols: raw.cols, grid: raw.grid, targets: [], decoys: [], mistakeBudget: 0 };
}

/**
 * Fairness gate (REQ-021..025). Returns failure reasons; empty = fair.
 */
export function validate(raw: RawPuzzle): string[] {
  const reasons: string[] = [];

  // REQ-024 — grid dimensions consistent.
  if (raw.grid.length !== raw.rows) reasons.push(`grid has ${raw.grid.length} rows, expected ${raw.rows}`);
  if (raw.grid.some((r) => r.length !== raw.cols)) reasons.push(`not all rows have ${raw.cols} cols`);
  if (raw.grid.some((r) => !/^[A-Z]+$/.test(r))) reasons.push("grid must be uppercase A-Z");
  if (reasons.length > 0) return reasons; // geometry checks below need a valid grid

  const view = gridView(raw);
  const inb = (c: { row: number; col: number }) => c.row >= 0 && c.row < raw.rows && c.col >= 0 && c.col < raw.cols;

  const checkGeometry = (p: RawPlacement, kind: string): string[] => {
    const out: string[] = [];
    if (!inb(p.start) || !inb(p.end)) out.push(`${kind} ${p.id}: endpoint out of bounds`);
    const cells = cellsBetween(p.start, p.end);
    if (cells === null) {
      out.push(`${kind} ${p.id}: endpoints not on a straight line`);
    } else if (cells.length !== norm(p.word).length) {
      // REQ-025 — cell count must equal word length.
      out.push(`${kind} ${p.id}: line spans ${cells.length} cells but word has ${norm(p.word).length}`);
    }
    return out;
  };

  for (const t of raw.targets) {
    const geo = checkGeometry(t, "target");
    reasons.push(...geo);
    if (geo.length === 0) {
      const cells = cellsBetween(t.start, t.end)!;
      // REQ-021 — reading start->end must equal reverse(targetWord).
      if (readForward(cells, view) !== reverse(norm(t.word))) {
        reasons.push(`target ${t.id}: does not read reversed along its line`);
      }
    }
  }
  for (const d of raw.decoys) {
    const geo = checkGeometry(d, "decoy");
    reasons.push(...geo);
    if (geo.length === 0) {
      const cells = cellsBetween(d.start, d.end)!;
      // REQ-022 — reading start->end must equal decoyWord (forward).
      if (readForward(cells, view) !== norm(d.word)) {
        reasons.push(`decoy ${d.id}: does not read forward along its line`);
      }
    }
  }

  // Unique ids (ERROR-004).
  const ids = [...raw.targets, ...raw.decoys].map((p) => p.id);
  if (new Set(ids).size !== ids.length) reasons.push("duplicate placement id");

  // REQ-023 — no target line identical to any decoy line (A->B == B->A).
  const decoyLines = new Set(raw.decoys.map((d) => lineKey(toPlacement(d))));
  for (const t of raw.targets) {
    if (decoyLines.has(lineKey(toPlacement(t)))) reasons.push(`target ${t.id}: shares a line with a decoy`);
  }

  if (raw.targets.length < 1) reasons.push("puzzle has no targets");

  return reasons;
}

function toPlacement(p: RawPlacement): Placement {
  return { id: p.id, word: norm(p.word), start: p.start, end: p.end };
}

export function buildPuzzle(puzzleId: string, raw: RawPuzzle): Puzzle | null {
  if (validate(raw).length > 0) return null;
  return {
    puzzleId,
    rows: raw.rows,
    cols: raw.cols,
    grid: raw.grid.slice(),
    targets: raw.targets.map(toPlacement),
    decoys: raw.decoys.map(toPlacement),
    mistakeBudget: raw.mistakeBudget ?? 0,
  };
}

export function assertPuzzleValid(raw: RawPuzzle): void {
  const reasons = validate(raw);
  if (reasons.length > 0) throw new Error(`undertow invalid puzzle:\n - ${reasons.join("\n - ")}`);
}
