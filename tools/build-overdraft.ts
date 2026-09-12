import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid } from "../src/games/overdraft/content-build.ts";
import type { Puzzle } from "../src/games/overdraft/types.ts";

// Overdraft build tool. Each puzzle's letter set is the distinct letters of a real
// "anchor" word (5-7 letters) plus a couple of extra common letters, guaranteeing
// a positive in-set word exists (the anchor). The gate re-verifies against the
// dictionary pool. Borrowing higher-value letters (e.g. adding an S/ER) is the
// optional risk/reward decision.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const PUZZLES = 80;
const EXTRA_LETTERS = "AEIORT"; // deterministic extras to round out the set

function main(): void {
  const anchors = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [5, 7] })), 5, 7).map((w) => w.toUpperCase());
  // Candidate dictionary for validation + the gate: 3-8 letter words.
  const candidates = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 50, lengths: [3, 8] })), 3, 8).map((w) => w.toUpperCase());
  if (anchors.length === 0 || candidates.length === 0) throw new Error("Overdraft: empty pools");
  const candidateSet = new Set(candidates);

  const spread = [...anchors].sort((a, b) => fnv1a32(a) - fnv1a32(b));
  const puzzles: Puzzle[] = [];
  const usedSets = new Set<string>();
  for (let i = 0; i < spread.length && puzzles.length < PUZZLES; i++) {
    const anchor = spread[i];
    if (!candidateSet.has(anchor)) continue; // anchor must be a valid dictionary word
    const letters = new Set(anchor.split(""));
    // add deterministic extras until the set has 8 distinct letters
    for (const ex of EXTRA_LETTERS) {
      if (letters.size >= 8) break;
      letters.add(ex);
    }
    const letterSet = [...letters].sort();
    const key = letterSet.join("");
    if (usedSets.has(key)) continue;
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(letterSet, id, candidates);
    if (p === null) continue;
    assertPuzzleValid(p, candidates);
    puzzles.push(p);
    usedSets.add(key);
  }
  if (puzzles.length < 20) throw new Error(`Overdraft: too few valid puzzles (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    dictionary: [...candidateSet].sort(),
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "overdraft.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`overdraft.json: ${puzzles.length} puzzles, ${candidateSet.size} dict words`);
}

main();
