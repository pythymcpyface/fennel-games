import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid } from "../src/games/isthmus/content-build.ts";
import type { Coord, Puzzle } from "../src/games/isthmus/types.ts";

// Isthmus build tool. Grids are constructed by laying a real dictionary word along
// a top->bottom 8-adjacent path, then filling the rest with deterministic letters.
// The content-build fairness gate re-derives a valid shore-to-shore word path.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const ROWS = 5;
const COLS = 5;
const PUZZLES = 60;
const MIN_LEN = ROWS; // must at least span the shores

function rngFrom(seed: string): () => number {
  let s = fnv1a32(seed) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Lay `word` on a path from top row to bottom row, one row per step where possible. */
function embedWord(word: string, rng: () => number): { grid: string[][]; path: Coord[] } | null {
  // Only embed words whose length allows a monotone top->bottom path: length >= ROWS
  // and <= ROWS + (ROWS-1) wiggle. Keep it simple: one letter per row, length == ROWS,
  // moving within +/-1 column each step (8-adjacency).
  if (word.length !== ROWS) return null;
  const grid: string[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ""),
  );
  const path: Coord[] = [];
  let col = Math.floor(rng() * COLS);
  for (let r = 0; r < ROWS; r++) {
    grid[r][col] = word[r].toUpperCase();
    path.push({ row: r, col });
    if (r < ROWS - 1) {
      const step = Math.floor(rng() * 3) - 1; // -1,0,+1
      col = Math.min(COLS - 1, Math.max(0, col + step));
    }
  }
  // Fill blanks with deterministic filler letters.
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === "") grid[r][c] = alphabet[Math.floor(rng() * 26)];
    }
  }
  return { grid, path };
}

function main(): void {
  const dictWords = filterByLength(
    filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [ROWS, ROWS] })),
    ROWS,
    ROWS,
  ).map((w) => w.toUpperCase());
  const dictionary = new Set(dictWords);
  if (dictionary.size === 0) throw new Error("Isthmus: empty dictionary");

  // Deterministically pick candidate words spread across the corpus.
  const spread = [...dictWords].sort((a, b) => fnv1a32(a) - fnv1a32(b));
  const puzzles: Puzzle[] = [];
  for (let i = 0; i < spread.length && puzzles.length < PUZZLES; i++) {
    const word = spread[i];
    const rng = rngFrom(word);
    const emb = embedWord(word, rng);
    if (!emb) continue;
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(emb.grid, dictionary, id, MIN_LEN, emb.path);
    if (p === null) continue;
    try {
      assertPuzzleValid(p, dictionary);
    } catch {
      continue;
    }
    puzzles.push(p);
  }
  if (puzzles.length < 20) throw new Error(`Isthmus: too few solvable grids (${puzzles.length}).`);

  // Ship a compact dictionary: only ROWS-length words (used for validation).
  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    dictionary: [...dictionary].sort(),
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "isthmus.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`isthmus.json: ${puzzles.length} puzzles, ${dictionary.size} dict words`);
}

main();
