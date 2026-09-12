import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength, buildEditDistanceGraph } from "../wordkit/src/index.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/tradeoff/content-build.ts";
import { SCRABBLE_VALUES } from "../src/games/tradeoff/engine.ts";

// Build-time generator wired to @cic/wordkit's edit-distance graph over the en-GB
// corpus. The full graph is computed at build time; only the reachable subgraph per
// puzzle ships (wordkit never ships to the client).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_tradeoff_v1";
const BUDGET = 3;

function main(): void {
  // Common 4-letter words make dense edit-distance graphs with score-climbing paths.
  const words = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 40 })), 4, 4).map((w) => w.toUpperCase());
  const graph = buildEditDistanceGraph(words);
  const neighbors: Record<string, string[]> = {};
  for (const [w, ns] of graph) neighbors[w] = ns;

  // Pick start words that (a) have low-ish score, (b) sit in a component with a
  // higher-scoring reachable word — the gate enforces the climb, so we just try many.
  const seeds = ["CARE", "LATE", "MARE", "TIDE", "RATE", "BONE", "PALE", "SANE", "LINE", "MOLE",
    "CORE", "DARE", "FATE", "GATE", "HIDE", "MILE", "NOSE", "PILE", "RISE", "TALE",
    "VANE", "WANE", "BASE", "CASE", "DOME", "FACE", "LACE", "MACE", "PACE", "RACE"];
  const candidates: CandidatePuzzle[] = seeds
    .filter((s) => neighbors[s] !== undefined)
    .map((s) => ({ startWord: s, swapBudget: BUDGET }));

  const puzzles = buildPuzzles(candidates, neighbors, SCRABBLE_VALUES);
  assertPuzzlesValid(puzzles);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC",
    puzzles,
  };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "tradeoff.json"), json);
  // eslint-disable-next-line no-console
  console.log(`tradeoff.json: ${puzzles.length} puzzles from ${words.length} 4-letter words, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 5)) {
    // eslint-disable-next-line no-console
    console.log(`  ${p.startWord} (budget ${p.swapBudget}) -> par ${p.parScore}, reachable ${Object.keys(p.neighbors).length}`);
  }
}

main();
