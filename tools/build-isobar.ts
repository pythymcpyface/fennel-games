import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, loadGloveVectors, filterAlphaOnly } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid, dist, ringForDistance, type SimilarityFn } from "../src/games/isobar/content-build.ts";
import type { Puzzle } from "../src/games/isobar/types.ts";

// Isobar build tool. Real GloVe cosine (build-machine only). Ships only ring
// indices (no vectors). Picks a hidden centre and 5 words landing on 5 distinct
// distance bands.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const GLOVE_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "wordkit", "vectors", "glove.6B.50d.txt");
const PUZZLES = 100;
const RING_COUNT = 5;
// Distance cutoffs (cosine distance) delimiting the 5 rings; tuned for GloVe-50d.
const CUTOFFS = [0.35, 0.5, 0.62, 0.72]; // ring0<0.35, ..., ring4>=0.72

function sampleSpread(pool: string[], n: number): string[] {
  if (pool.length <= n) return [...pool];
  return [...pool].sort((a, b) => fnv1a32(a) - fnv1a32(b)).slice(0, n).sort();
}

function main(): void {
  if (!existsSync(GLOVE_PATH)) throw new Error(`GloVe vectors not found at ${GLOVE_PATH}.`);
  const provider = loadGloveVectors(GLOVE_PATH);
  const sim: SimilarityFn = (a, b) => provider.cosine(a.toLowerCase(), b.toLowerCase());
  const has = (w: string) => provider.has(w.toLowerCase());

  const pool = sampleSpread(
    filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [3, 9] })).filter((w) => has(w)),
    1500,
  ).map((w) => w.toUpperCase());

  const puzzles: Puzzle[] = [];
  const usedCenters = new Set<string>();
  for (let i = 0; i < pool.length && puzzles.length < PUZZLES; i++) {
    const center = pool[i];
    if (usedCenters.has(center)) continue;
    // For each ring band, find the first candidate word that lands in it.
    const perRing: (string | null)[] = new Array(RING_COUNT).fill(null);
    for (let j = 0; j < pool.length; j++) {
      const w = pool[(i + j * 97) % pool.length];
      if (w === center) continue;
      const ring = ringForDistance(dist(sim, center, w), CUTOFFS);
      if (perRing[ring] === null) perRing[ring] = w;
      if (perRing.every((x) => x !== null)) break;
    }
    if (perRing.some((x) => x === null)) continue;
    const words = perRing as string[];
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(sim, center, words, CUTOFFS, id);
    if (p === null) continue;
    assertPuzzleValid(p);
    puzzles.push(p);
    usedCenters.add(center);
    words.forEach((w) => usedCenters.add(w));
  }
  if (puzzles.length < 20) throw new Error(`Isobar: too few fair puzzles (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "isobar.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`isobar.json: ${puzzles.length} puzzles`);
}

main();
