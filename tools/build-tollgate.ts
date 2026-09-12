import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { neighbours, dijkstraParCost, buildPuzzle, assertPuzzleValid } from "../src/games/tollgate/content-build.ts";
import type { Puzzle } from "../src/games/tollgate/types.ts";

// Tollgate build tool. Deterministic per-letter toll table; start/target pairs of
// the same length that are reachable in the one-letter-change graph. Par computed
// by Dijkstra at build time (also the fairness gate).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const WORD_LEN = 4; // 4-letter ladders are dense -> good connectivity
const PUZZLES = 80;

/** Deterministic toll table: common letters cheap (1), rarer letters pricier (up to 5). */
function tollTable(): number[] {
  // Frequency-ranked-ish tolls; deterministic and fixed for all puzzles.
  const order = "ETAOINSHRDLCUMWFGYPBVKJXQZ"; // rough English frequency
  const tolls = new Array(26).fill(3);
  for (let i = 0; i < order.length; i++) {
    const code = order.charCodeAt(i) - 65;
    // cheapest for most frequent, ramping to 5 for rarest
    tolls[code] = 1 + Math.floor((i / order.length) * 5); // 1..5
  }
  return tolls;
}

function main(): void {
  const four = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [WORD_LEN, WORD_LEN] })), WORD_LEN, WORD_LEN).map((w) => w.toUpperCase());
  const wordSet = new Set(four);
  if (wordSet.size === 0) throw new Error("Tollgate: empty word set");
  const tolls = tollTable();

  const spread = [...four].sort((a, b) => fnv1a32(a) - fnv1a32(b));
  const puzzles: Puzzle[] = [];
  const usedPairs = new Set<string>();
  for (let i = 0; i < spread.length && puzzles.length < PUZZLES; i++) {
    const start = spread[i];
    // pick a target a few hops away for a non-trivial ladder
    const nb1 = neighbours(start, wordSet);
    if (nb1.length === 0) continue;
    // deterministic target: a neighbour of a neighbour (2 hops) if available
    const mid = nb1[fnv1a32(start) % nb1.length];
    const nb2 = neighbours(mid, wordSet).filter((w) => w !== start);
    const target = nb2.length > 0 ? nb2[fnv1a32(mid) % nb2.length] : mid;
    if (start === target) continue;
    const key = [start, target].sort().join("-");
    if (usedPairs.has(key)) continue;
    const par = dijkstraParCost(start, target, tolls, wordSet);
    if (!Number.isFinite(par) || par <= 0) continue;
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(start, target, tolls, wordSet, id);
    if (p === null) continue;
    assertPuzzleValid(p, wordSet);
    puzzles.push(p);
    usedPairs.add(key);
  }
  if (puzzles.length < 20) throw new Error(`Tollgate: too few reachable pairs (${puzzles.length}).`);

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
  writeFileSync(join(outDir, "tollgate.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`tollgate.json: ${puzzles.length} puzzles, ${wordSet.size} dict words`);
}

main();
