import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { neighbours, bfsDistances, computePar, buildPuzzle, assertPuzzleValid } from "../src/games/fork/content-build.ts";
import type { Puzzle } from "../src/games/fork/types.ts";

// Fork build tool. Picks start + two targets (4-letter, dense graph) reachable from
// start; par computed by BFS (also the fairness gate).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const WORD_LEN = 4;
const PUZZLES = 80;

function main(): void {
  const four = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [WORD_LEN, WORD_LEN] })), WORD_LEN, WORD_LEN).map((w) => w.toUpperCase());
  const wordSet = new Set(four);
  if (wordSet.size === 0) throw new Error("Fork: empty word set");

  const spread = [...four].sort((a, b) => fnv1a32(a) - fnv1a32(b));
  const puzzles: Puzzle[] = [];
  const usedStarts = new Set<string>();
  for (let i = 0; i < spread.length && puzzles.length < PUZZLES; i++) {
    const start = spread[i];
    if (usedStarts.has(start)) continue;
    const dist = bfsDistances(start, wordSet);
    // pick two targets 2-4 steps away, distinct, deterministically
    const reachable = [...dist.entries()].filter(([w, d]) => w !== start && d >= 2 && d <= 4).map(([w]) => w);
    if (reachable.length < 2) continue;
    reachable.sort((a, b) => fnv1a32(a + start) - fnv1a32(b + start));
    const targetA = reachable[0];
    const targetB = reachable.find((w) => w !== targetA)!;
    const par = computePar(start, targetA, targetB, wordSet);
    if (!Number.isFinite(par) || par <= 0) continue;
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(start, targetA, targetB, wordSet, id);
    if (p === null) continue;
    assertPuzzleValid(p, wordSet);
    puzzles.push(p);
    usedStarts.add(start);
  }
  if (puzzles.length < 20) throw new Error(`Fork: too few reachable triples (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    dictionary: [...wordSet].sort(),
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "fork.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`fork.json: ${puzzles.length} puzzles, ${wordSet.size} dict words`);
  void neighbours;
}

main();
