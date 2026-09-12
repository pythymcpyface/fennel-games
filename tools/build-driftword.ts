import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { findLadders, buildPuzzle, assertPuzzleValid } from "../src/games/driftword/content-build.ts";
import type { Puzzle } from "../src/games/driftword/types.ts";

// Driftword build tool. Discovers word-ladder paths (each step a one-letter change,
// each word real) from the wordkit en-GB corpus. The engine drifts the target one
// step per guess; the gate proves each path is a valid ladder.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const PATH_LEN = 6; // GUESS_BUDGET; the target can drift once per guess
const PUZZLES = 100;

function main(): void {
  const five = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [5, 5] })), 5, 5).map((w) => w.toUpperCase());
  const dictionary = new Set(five);
  if (dictionary.size === 0) throw new Error("Driftword: empty dictionary");

  // Deterministic spread of candidate start words for reproducible ladders.
  const spread = [...five].sort((a, b) => fnv1a32(a) - fnv1a32(b));
  const ladders = findLadders(spread, dictionary, PATH_LEN, PUZZLES);

  const puzzles: Puzzle[] = [];
  for (const path of ladders) {
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(path, dictionary, id);
    if (p === null) continue;
    assertPuzzleValid(p, dictionary);
    puzzles.push(p);
  }
  if (puzzles.length < 20) throw new Error(`Driftword: too few ladders (${puzzles.length}).`);

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
  writeFileSync(join(outDir, "driftword.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`driftword.json: ${puzzles.length} puzzles, ${dictionary.size} dict words`);
}

main();
