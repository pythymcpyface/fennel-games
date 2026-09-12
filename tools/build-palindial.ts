import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength, buildEditDistanceGraph } from "../wordkit/src/index.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/palindial/content-build.ts";
import { reverse } from "../src/games/palindial/engine.ts";

// Build-time generator wired to @cic/wordkit. Finds words whose reverse is also a
// word, builds the edit-distance graph, and keeps only those whose reverse-twin is
// reachable within the move budget. wordkit never ships (only the derived pack does).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_palindial_v1";
const BUDGET = 5;

function main(): void {
  const words = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 40 })), 4, 4).map((w) => w.toUpperCase());
  const dictionary = new Set(words);
  const graph = buildEditDistanceGraph(words);
  const neighbors: Record<string, string[]> = {};
  for (const [w, ns] of graph) neighbors[w] = ns;

  // Candidate starts: words whose reverse is also a word and differs.
  const candidates: CandidatePuzzle[] = [];
  for (const w of words) {
    const r = reverse(w);
    if (r !== w && dictionary.has(r) && neighbors[w]) candidates.push({ startWord: w, moveBudget: BUDGET });
  }

  const puzzles = buildPuzzles(candidates, neighbors, dictionary).slice(0, 12);
  assertPuzzlesValid(puzzles);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "palindial.json"), json);
  // eslint-disable-next-line no-console
  console.log(`palindial.json: ${puzzles.length} puzzles from ${candidates.length} reversible pairs, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 6)) console.log(`  ${p.startWord} -> ${p.targetWord} (reachable in <=${p.moveBudget})`);
}

main();
