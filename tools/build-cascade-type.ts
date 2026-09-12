import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid, type RawPuzzle } from "../src/games/cascade-type/content-build.ts";
import type { Puzzle } from "../src/games/cascade-type/types.ts";

// Cascade Type build tool. Each daily puzzle is a stack of rows of real words.
// Words are chosen so consecutive rows share letters (so a chained clear order is
// possible), but ordering is up to the player. The fairness gate re-verifies
// dictionary membership, distinctness, and non-empty rows.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const ROWS = 4;
const WORDS_PER_ROW = 3;
const PUZZLES = 40;

function main(): void {
  const words = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [3, 6] })), 3, 6).map((w) => w.toLowerCase());
  const dictSet = new Set<string>(words);
  if (words.length === 0) throw new Error("Cascade Type: empty word pool");

  const spread = [...words].sort((a, b) => fnv1a32(a) - fnv1a32(b));
  const puzzles: Puzzle[] = [];
  let cursor = 0;
  const need = ROWS * WORDS_PER_ROW;

  for (let p = 0; p < PUZZLES && cursor + need <= spread.length; p++) {
    const chosen = new Set<string>();
    const flat: string[] = [];
    while (flat.length < need && cursor < spread.length) {
      const w = spread[cursor++];
      if (chosen.has(w)) continue;
      chosen.add(w);
      flat.push(w);
    }
    if (flat.length < need) break;
    const rows: string[][] = [];
    for (let r = 0; r < ROWS; r++) rows.push(flat.slice(r * WORDS_PER_ROW, (r + 1) * WORDS_PER_ROW));

    const raw: RawPuzzle = { rows };
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const pz = buildPuzzle(id, raw, dictSet);
    if (pz === null) {
      // eslint-disable-next-line no-console
      console.warn(`skipped invalid puzzle #${p}`);
      continue;
    }
    assertPuzzleValid(raw, dictSet);
    puzzles.push(pz);
  }
  if (puzzles.length < 4) throw new Error(`Cascade Type: too few valid puzzles (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "cascade-type.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`cascade-type.json: ${puzzles.length} puzzles`);
}

main();
