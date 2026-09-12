import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid, type RawPuzzle } from "../src/games/decay/content-build.ts";
import type { Puzzle, Target } from "../src/games/decay/types.ts";

// Decay build tool. Each daily puzzle is a set of real dictionary words, each with
// a deterministic decay order (a shuffled permutation of its letter indices). The
// fairness gate re-verifies dictionary membership, distinctness, and valid
// permutations.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const WORDS_PER_PUZZLE = 5;
const PUZZLES = 40;

/** Deterministic permutation of [0..n-1] seeded by a string. */
function decayOrder(word: string): number[] {
  const n = word.length;
  const order = Array.from({ length: n }, (_, i) => i);
  let s = fnv1a32(`decay:${word}`) >>> 0;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = Math.floor((s / 0x100000000) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function main(): void {
  const words = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [4, 7] })), 4, 7).map((w) => w.toLowerCase());
  const dictSet = new Set<string>(words);
  if (words.length === 0) throw new Error("Decay: empty word pool");

  const spread = [...words].sort((a, b) => fnv1a32(a) - fnv1a32(b));
  const puzzles: Puzzle[] = [];
  let cursor = 0;
  for (let p = 0; p < PUZZLES && cursor + WORDS_PER_PUZZLE <= spread.length; p++) {
    const chosen = new Set<string>();
    const targets: Target[] = [];
    while (targets.length < WORDS_PER_PUZZLE && cursor < spread.length) {
      const w = spread[cursor++];
      if (chosen.has(w)) continue;
      chosen.add(w);
      targets.push({ word: w, decayOrder: decayOrder(w) });
    }
    if (targets.length < WORDS_PER_PUZZLE) break;
    const raw: RawPuzzle = { targets, lockThreshold: WORDS_PER_PUZZLE };
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
  if (puzzles.length < 4) throw new Error(`Decay: too few valid puzzles (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "decay.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`decay.json: ${puzzles.length} puzzles`);
}

main();
