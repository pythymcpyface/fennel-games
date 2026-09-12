import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid, type RawPuzzle, type RawTarget } from "../src/games/fogline/content-build.ts";
import type { Coord } from "../src/games/fogline/types.ts";
import type { Puzzle } from "../src/games/fogline/types.ts";

// Fogline build tool. Places target words FORWARD onto a grid, fills blanks with
// deterministic letters, seeds an initial revealed region that fully covers the
// FIRST target (guaranteeing solvable-from-seed), and sets a fog reveal radius.
// The fairness gate re-verifies forward reads, dims, spans, and seed solvability.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "fogline.curated.v1";
const SIZE = 8;
const RADIUS = 2;

interface Spec {
  words: string[];
}

const SPECS: Spec[] = [
  { words: ["FOREST", "TRAIL", "MOSS", "FERN", "PINE"] },
  { words: ["HARBOR", "TIDE", "SAIL", "DOCK", "BUOY"] },
  { words: ["DESERT", "DUNE", "OASIS", "SAND", "CAMEL"] },
  { words: ["MEADOW", "CLOVER", "BEE", "HIVE", "GRASS"] },
  { words: ["CANYON", "RIVER", "MESA", "CLIFF", "STONE"] },
  { words: ["GLACIER", "SNOW", "ICE", "PEAK", "FROST"] },
];

const DIRS: Coord[] = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: -1 },
];

interface Grid {
  cells: string[][];
}

function tryPlace(grid: Grid, word: string, rand: () => number): { start: Coord; dir: Coord } | null {
  const n = word.length;
  for (let attempt = 0; attempt < 300; attempt++) {
    const dir = DIRS[Math.floor(rand() * DIRS.length)];
    const r0 = Math.floor(rand() * SIZE);
    const c0 = Math.floor(rand() * SIZE);
    const rEnd = r0 + dir.row * (n - 1);
    const cEnd = c0 + dir.col * (n - 1);
    if (rEnd < 0 || rEnd >= SIZE || cEnd < 0 || cEnd >= SIZE) continue;
    let ok = true;
    for (let i = 0; i < n; i++) {
      const r = r0 + dir.row * i;
      const c = c0 + dir.col * i;
      const cur = grid.cells[r][c];
      if (cur !== "" && cur !== word[i]) { ok = false; break; }
    }
    if (!ok) continue;
    for (let i = 0; i < n; i++) {
      const r = r0 + dir.row * i;
      const c = c0 + dir.col * i;
      grid.cells[r][c] = word[i];
    }
    return { start: { row: r0, col: c0 }, dir };
  }
  return null;
}

function buildRaw(spec: Spec, seed: number): RawPuzzle {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const grid: Grid = { cells: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => "")) };
  const targets: RawTarget[] = [];
  spec.words.forEach((w, i) => {
    const up = w.toUpperCase();
    const placed = tryPlace(grid, up, rand);
    if (!placed) throw new Error(`could not place ${up}`);
    targets.push({ id: `T${i}`, word: up, start: placed.start, dir: placed.dir });
  });

  const ALPHA = "ETAOINSHRDLU";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid.cells[r][c] === "") grid.cells[r][c] = ALPHA[Math.floor(rand() * ALPHA.length)];
    }
  }

  // Seed reveal: fully cover the FIRST target plus a small halo, guaranteeing
  // solvable-from-seed. Compute the first target's cells + Chebyshev radius-1 halo.
  const first = targets[0];
  const seedSet = new Map<string, Coord>();
  for (let i = 0; i < first.word.length; i++) {
    const cr = first.start.row + first.dir.row * i;
    const cc = first.start.col + first.dir.col * i;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = cr + dr;
        const c = cc + dc;
        if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) seedSet.set(`${r},${c}`, { row: r, col: c });
      }
    }
  }

  return {
    rows: SIZE,
    cols: SIZE,
    grid: grid.cells.map((row) => row.join("")),
    targets,
    seedCells: [...seedSet.values()],
    fogRevealRadius: RADIUS,
    distanceMetric: "CHEBYSHEV",
  };
}

function main(): void {
  const puzzles: Puzzle[] = [];
  SPECS.forEach((spec, i) => {
    const raw = buildRaw(spec, fnv1a32(`fogline-${i}`));
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
  if (puzzles.length < 4) throw new Error(`Fogline: too few valid puzzles (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "fogline.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`fogline.json: ${puzzles.length} puzzles`);
}

main();
