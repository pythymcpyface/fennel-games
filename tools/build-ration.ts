import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid } from "../src/games/ration/content-build.ts";
import { lettersOf } from "../src/games/ration/engine.ts";
import type { LetterCounts, Puzzle, TargetBucket } from "../src/games/ration/types.ts";

// Ration build tool. Construct each puzzle by choosing a small solution set of real
// words (one 5-, two 4-, two 3-letter), summing their letters into the shared
// inventory (plus a little slack), then set targets to that histogram. The fairness
// gate re-verifies achievability against a candidate dictionary pool.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const PUZZLES = 80;
const TARGETS: TargetBucket[] = [
  { length: 5, count: 1 },
  { length: 4, count: 2 },
  { length: 3, count: 2 },
];

function main(): void {
  const three = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [3, 3] })), 3, 3).map((w) => w.toUpperCase());
  const four = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [4, 4] })), 4, 4).map((w) => w.toUpperCase());
  const five = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [5, 5] })), 5, 5).map((w) => w.toUpperCase());
  const candidates = [...three, ...four, ...five];
  if (three.length === 0 || four.length === 0 || five.length === 0) throw new Error("Ration: empty pools");

  const pick = (pool: string[], seed: string, k: number): string[] => {
    const sorted = [...pool].sort((a, b) => fnv1a32(a + seed) - fnv1a32(b + seed));
    return sorted.slice(0, k);
  };

  const puzzles: Puzzle[] = [];
  for (let i = 0; i < PUZZLES * 3 && puzzles.length < PUZZLES; i++) {
    const seed = `ration-${i}`;
    const sol = [
      ...pick(five, seed + "5", 1),
      ...pick(four, seed + "4", 2),
      ...pick(three, seed + "3", 2),
    ];
    if (new Set(sol).size !== sol.length) continue;
    // Inventory = exact sum of solution letters (tight budget makes it interesting).
    const inv: LetterCounts = {};
    for (const w of sol) for (const [ch, n] of Object.entries(lettersOf(w))) inv[ch] = (inv[ch] ?? 0) + n;
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(inv, TARGETS, candidates, id);
    if (p === null) continue;
    assertPuzzleValid(p, candidates);
    puzzles.push(p);
  }
  if (puzzles.length < 20) throw new Error(`Ration: too few solvable puzzles (${puzzles.length}).`);

  // Ship a compact dictionary: only 3-5 letter words (used to validate submissions).
  const dictionary = [...new Set(candidates)].sort();
  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    dictionary,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "ration.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`ration.json: ${puzzles.length} puzzles, ${dictionary.length} dict words`);
}

main();
