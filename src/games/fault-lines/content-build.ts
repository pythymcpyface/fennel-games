import type { Direction, Entry, Puzzle } from "./types.ts";

// Build-time content generation + fairness gate for Fault Lines (TERM-026). Pure +
// deterministic. Given a grid and a set of entries — each with a TRUE answer and a
// DISPLAYED answer (which for faulty entries is a different real word) — the gate
// proves the puzzle is fair and internally consistent.

export interface RawEntry {
  entryId: string;
  number: number;
  direction: Direction;
  clue: string;
  /** The correct answer implied by the clue (TERM-011). Used only at build time. */
  trueAnswer: string;
  /** What is shown in the grid. Equals trueAnswer unless this entry is faulty. */
  displayedAnswer: string;
  cells: number[];
  isFaulty: boolean;
}

export interface RawPuzzle {
  rows: number;
  cols: number;
  /** Block cells as flat indexes. */
  blocks: number[];
  entries: RawEntry[];
}

export function norm(s: string): string {
  return s.trim().toUpperCase();
}

function isAZ(s: string): boolean {
  return /^[A-Z]+$/.test(s);
}

/** Build the displayed letter grid from the entries' displayed answers. */
function layDisplayedLetters(raw: RawPuzzle): string[] {
  const letters = new Array<string>(raw.rows * raw.cols).fill("");
  for (const e of raw.entries) {
    const da = norm(e.displayedAnswer);
    e.cells.forEach((cellIdx, k) => {
      letters[cellIdx] = da[k] ?? "";
    });
  }
  return letters;
}

/**
 * REQ-022 — the TRUE grid must be internally consistent: at any cell shared by
 * two entries, the true-answer letters must agree. Returns the conflicting cell
 * index, or -1 if consistent.
 */
export function trueGridConflict(raw: RawPuzzle): number {
  const seen = new Map<number, string>();
  for (const e of raw.entries) {
    const ta = norm(e.trueAnswer);
    for (let k = 0; k < e.cells.length; k++) {
      const cell = e.cells[k];
      const ch = ta[k];
      const prev = seen.get(cell);
      if (prev !== undefined && prev !== ch) return cell;
      seen.set(cell, ch);
    }
  }
  return -1;
}

/**
 * Fairness gate (REQ-020..025). Returns a list of failure reasons; empty = fair.
 * `dictionary` is the set of valid words for the fault-word check (REQ-024).
 */
export function validate(raw: RawPuzzle, dictionary: ReadonlySet<string>): string[] {
  const reasons: string[] = [];
  const n = raw.entries.length;

  if (raw.rows < 1 || raw.cols < 1) reasons.push("grid dimensions must be positive");
  const size = raw.rows * raw.cols;

  for (const e of raw.entries) {
    const da = norm(e.displayedAnswer);
    const ta = norm(e.trueAnswer);
    // REQ-020/021 — geometry fit for both displayed and true answers.
    if (da.length !== e.cells.length) reasons.push(`${e.entryId}: displayed length != cell count`);
    if (ta.length !== e.cells.length) reasons.push(`${e.entryId}: true length != cell count`);
    if (!isAZ(da)) reasons.push(`${e.entryId}: displayed answer must be A-Z`);
    if (!isAZ(ta)) reasons.push(`${e.entryId}: true answer must be A-Z`);
    if (e.cells.some((c) => c < 0 || c >= size)) reasons.push(`${e.entryId}: cell index out of range`);
    if (e.cells.some((c) => raw.blocks.includes(c))) reasons.push(`${e.entryId}: entry overlaps a block cell`);

    if (e.isFaulty) {
      // REQ-023 — a fault must actually deviate from the true answer.
      if (da === ta) reasons.push(`${e.entryId}: marked faulty but displayed == true`);
      // REQ-024 — the faulty displayed word must be a real dictionary word.
      if (!dictionary.has(da)) reasons.push(`${e.entryId}: faulty word not in dictionary`);
    } else {
      // A non-faulty entry must show its true answer.
      if (da !== ta) reasons.push(`${e.entryId}: not faulty but displayed != true`);
    }
  }

  // REQ-025 — at least one fault, and not all entries faulty.
  const faults = raw.entries.filter((e) => e.isFaulty).length;
  if (faults < 1) reasons.push("puzzle has no faults");
  if (faults >= n) reasons.push("puzzle is entirely faults");

  // REQ-022 — true grid crossing consistency.
  const conflict = trueGridConflict(raw);
  if (conflict >= 0) reasons.push(`true grid crossing conflict at cell ${conflict}`);

  return reasons;
}

export function buildPuzzle(puzzleId: string, raw: RawPuzzle, dictionary: ReadonlySet<string>): Puzzle | null {
  if (validate(raw, dictionary).length > 0) return null;
  const blocks = new Array<boolean>(raw.rows * raw.cols).fill(false);
  raw.blocks.forEach((b) => (blocks[b] = true));
  const entries: Entry[] = raw.entries.map((e) => ({
    entryId: e.entryId,
    number: e.number,
    direction: e.direction,
    clue: e.clue.trim(),
    displayedAnswer: norm(e.displayedAnswer),
    cells: e.cells.slice(),
    isFaulty: e.isFaulty,
  }));
  return {
    puzzleId,
    rows: raw.rows,
    cols: raw.cols,
    blocks,
    letters: layDisplayedLetters(raw),
    entries,
    faultCount: entries.filter((e) => e.isFaulty).length,
  };
}

export function assertPuzzleValid(raw: RawPuzzle, dictionary: ReadonlySet<string>): void {
  const reasons = validate(raw, dictionary);
  if (reasons.length > 0) {
    throw new Error(`fault-lines invalid puzzle:\n - ${reasons.join("\n - ")}`);
  }
}
