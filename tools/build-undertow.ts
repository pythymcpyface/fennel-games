import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid, type RawPuzzle, type RawPlacement } from "../src/games/undertow/content-build.ts";
import type { Puzzle } from "../src/games/undertow/types.ts";

// Undertow build tool. Each puzzle embeds target words REVERSED and decoy words
// FORWARD onto a grid, then fills the remaining cells with deterministic letters.
// The fairness gate re-verifies that targets read reversed and decoys read forward
// along their claimed lines, dimensions are consistent, and no lines collide.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "undertow.curated.v1";
const SIZE = 8;

interface Spec {
  targets: string[]; // hidden reversed
  decoys: string[]; // forward traps
}

// 6 daily specs. Words <= 8 chars to fit an 8x8 grid on a single row/col/diagonal.
const SPECS: Spec[] = [
  { targets: ["OCEAN", "TIDE", "REEF"], decoys: ["SHORE", "WAVE"] },
  { targets: ["RIVER", "DELTA", "BANK"], decoys: ["FLOOD", "SILT"] },
  { targets: ["STORM", "GALE", "SQUALL"], decoys: ["CALM", "BREEZE"] },
  { targets: ["CORAL", "KELP", "SHOAL"], decoys: ["DIVER", "PEARL"] },
  { targets: ["DRIFT", "CURRENT", "EDDY"], decoys: ["ANCHOR", "SAIL"] },
  { targets: ["MAROON", "ISLAND", "COVE"], decoys: ["RAFT", "BEACON"] },
];

type Dir = { dr: number; dc: number };
const DIRS: Dir[] = [
  { dr: 0, dc: 1 }, // →
  { dr: 1, dc: 0 }, // ↓
  { dr: 1, dc: 1 }, // ↘
  { dr: 1, dc: -1 }, // ↙
];

interface Grid {
  cells: string[][];
}
interface Placed {
  word: string;
  start: { row: number; col: number };
  end: { row: number; col: number };
  reversed: boolean;
}

/** Try to place `text` (already oriented as it should read forward in the grid). */
function tryPlace(grid: Grid, text: string, rand: () => number, usedLines: Set<string>): Placed | null {
  const n = text.length;
  for (let attempt = 0; attempt < 200; attempt++) {
    const dir = DIRS[Math.floor(rand() * DIRS.length)];
    const r0 = Math.floor(rand() * SIZE);
    const c0 = Math.floor(rand() * SIZE);
    const rEnd = r0 + dir.dr * (n - 1);
    const cEnd = c0 + dir.dc * (n - 1);
    if (rEnd < 0 || rEnd >= SIZE || cEnd < 0 || cEnd >= SIZE) continue;
    const key = lineKey(r0, c0, rEnd, cEnd);
    if (usedLines.has(key)) continue;
    // Check cells are empty or already match the intended letter.
    let ok = true;
    for (let i = 0; i < n; i++) {
      const r = r0 + dir.dr * i;
      const c = c0 + dir.dc * i;
      const cur = grid.cells[r][c];
      if (cur !== "" && cur !== text[i]) { ok = false; break; }
    }
    if (!ok) continue;
    for (let i = 0; i < n; i++) {
      const r = r0 + dir.dr * i;
      const c = c0 + dir.dc * i;
      grid.cells[r][c] = text[i];
    }
    usedLines.add(key);
    return { word: text, start: { row: r0, col: c0 }, end: { row: rEnd, col: cEnd }, reversed: false };
  }
  return null;
}

function lineKey(r0: number, c0: number, r1: number, c1: number): string {
  const a = `${r0},${c0}`;
  const b = `${r1},${c1}`;
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

function buildRaw(spec: Spec, seed: number): RawPuzzle | null {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const grid: Grid = { cells: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => "")) };
  const usedLines = new Set<string>();

  const targets: RawPlacement[] = [];
  const decoys: RawPlacement[] = [];

  // Targets are placed REVERSED (so reading the line and reversing gives the word).
  spec.targets.forEach((w, i) => {
    const up = w.toUpperCase();
    const placed = tryPlace(grid, up.split("").reverse().join(""), rand, usedLines);
    if (!placed) throw new Error(`could not place target ${up}`);
    targets.push({ id: `T${i}`, word: up, start: placed.start, end: placed.end });
  });
  // Decoys are placed FORWARD.
  spec.decoys.forEach((w, i) => {
    const up = w.toUpperCase();
    const placed = tryPlace(grid, up, rand, usedLines);
    if (!placed) throw new Error(`could not place decoy ${up}`);
    decoys.push({ id: `D${i}`, word: up, start: placed.start, end: placed.end });
  });

  // Fill blanks with deterministic letters (avoid accidentally completing extra words
  // is out of scope; the gate only validates the declared placements).
  const ALPHA = "ETAOINSHRDLU";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid.cells[r][c] === "") grid.cells[r][c] = ALPHA[Math.floor(rand() * ALPHA.length)];
    }
  }

  return {
    rows: SIZE,
    cols: SIZE,
    grid: grid.cells.map((row) => row.join("")),
    targets,
    decoys,
    mistakeBudget: 0,
  };
}

function main(): void {
  const puzzles: Puzzle[] = [];
  SPECS.forEach((spec, i) => {
    const raw = buildRaw(spec, fnv1a32(`undertow-${i}`));
    if (raw === null) return;
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(id, raw);
    if (p === null) {
      // eslint-disable-next-line no-console
      console.warn(`skipped invalid puzzle #${i}`);
      return;
    }
    assertPuzzleValid(raw);
    puzzles.push(p);
  });
  if (puzzles.length < 4) throw new Error(`Undertow: too few valid puzzles (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "undertow.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`undertow.json: ${puzzles.length} puzzles`);
}

main();
