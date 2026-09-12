import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, loadGloveVectors, filterAlphaOnly } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import {
  buildPuzzle,
  assertPuzzleValid,
  balanceValue,
  isFairTriple,
  packCodes,
  type SimilarityFn,
} from "../src/games/parallax/content-build.ts";
import type { Puzzle, PackedPuzzle } from "../src/games/parallax/types.ts";

// Parallax build tool. Real GloVe cosine (build-machine only); only quantised
// balance/closeness bands ship — no vectors at runtime.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const GLOVE_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "wordkit", "vectors", "glove.6B.50d.txt");
const PUZZLES = 120;
const VOCAB_CAP = 900; // per-puzzle candidate vocabulary (shared)

function sampleSpread(pool: string[], n: number): string[] {
  if (pool.length <= n) return [...pool];
  return [...pool].sort((a, b) => fnv1a32(a) - fnv1a32(b)).slice(0, n).sort();
}

function main(): void {
  if (!existsSync(GLOVE_PATH)) {
    throw new Error(`GloVe vectors not found at ${GLOVE_PATH}. Run \`npm run fetch-glove\` in wordkit/ first.`);
  }
  const provider = loadGloveVectors(GLOVE_PATH);
  const sim: SimilarityFn = (a, b) => provider.cosine(a.toLowerCase(), b.toLowerCase());
  const has = (w: string) => provider.has(w.toLowerCase());

  // Candidate pool: common words present in GloVe.
  const pool = sampleSpread(
    filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [3, 9] })).filter((w) => has(w)),
    1600,
  ).map((w) => w.toUpperCase());

  // Shared vocabulary for feedback tables (bounded for pack size).
  const vocab = sampleSpread(pool, VOCAB_CAP);

  // Find fair triples: pick two well-separated anchors, then a target that is
  // genuinely balanced between them.
  const puzzles: Puzzle[] = [];
  const usedTargets = new Set<string>();
  for (let i = 0; i < pool.length && puzzles.length < PUZZLES; i++) {
    const a = pool[i];
    for (let step = 1; step <= 12 && puzzles.length < PUZZLES; step++) {
      const b = pool[(i + step * 211) % pool.length];
      if (a === b) continue;
      // scan vocab for the most-balanced target between a and b
      let best: { w: string; off: number } | null = null;
      for (const w of vocab) {
        if (w === a || w === b || usedTargets.has(w)) continue;
        const bal = balanceValue(sim, w, a, b);
        const off = Math.abs(bal - 0.5);
        if (best === null || off < best.off) best = { w, off };
      }
      if (best && isFairTriple(sim, has, a, b, best.w)) {
        const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
        const p = buildPuzzle(sim, has, a, b, best.w, vocab, id);
        assertPuzzleValid(p);
        puzzles.push(p);
        usedTargets.add(best.w);
        break; // one puzzle per anchorA
      }
    }
  }

  if (puzzles.length < 30) {
    throw new Error(`Parallax: too few fair puzzles (${puzzles.length}); loosen the gate.`);
  }

  // Compact: ship one shared vocab + per-puzzle packed codes (1 char/word) instead
  // of 120 × 900-entry object maps.
  const packed: PackedPuzzle[] = puzzles.map((p) => ({
    puzzleId: p.puzzleId,
    anchorA: p.anchorA,
    anchorB: p.anchorB,
    target: p.target,
    codes: packCodes(p.table, vocab),
  }));

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: packed.length,
    dayBoundaryRule: "UTC" as const,
    vocab,
    puzzles: packed,
  };

  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "parallax.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`parallax.json: ${packed.length} puzzles, vocab ${vocab.length}`);
}

main();
