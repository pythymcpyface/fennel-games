import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid, rackFromLetters, weightFor, type RawPuzzle } from "../src/games/tare/content-build.ts";
import type { Puzzle, Tile } from "../src/games/tare/types.ts";

// Tare build tool. Finds pairs of real dictionary words whose combined letters
// form the daily rack and whose total weights balance within a small tolerance.
// The rack is exactly the two words' letters; each puzzle ships the rack +
// tolerance (the guaranteed solution is used only by the fairness gate, not
// shipped, to keep the answer hidden). The runtime dictionary ships for
// validation of the player's own split.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const TOLERANCE = 1;
const TARGET_PUZZLES = 40;

function wordWeight(word: string): number {
  return word.toUpperCase().split("").reduce((n, ch) => n + weightFor(ch), 0);
}

function letterMultiset(word: string): string {
  return word.toUpperCase().split("").sort().join("");
}

function main(): void {
  // Words length 3-6 for a manageable rack (6-12 tiles total).
  const words = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [3, 6] })), 3, 6).map((w) => w.toUpperCase());
  const dictSet = new Set<string>(words);
  if (words.length === 0) throw new Error("Tare: empty word pool");

  // Group words by weight so we can pair equal/near-equal weights quickly.
  const byWeight = new Map<number, string[]>();
  for (const w of words) {
    const wt = wordWeight(w);
    if (!byWeight.has(wt)) byWeight.set(wt, []);
    byWeight.get(wt)!.push(w);
  }

  const spread = [...words].sort((a, b) => fnv1a32(a) - fnv1a32(b));
  const puzzles: Puzzle[] = [];
  const usedRacks = new Set<string>();

  for (let i = 0; i < spread.length && puzzles.length < TARGET_PUZZLES; i++) {
    const left = spread[i];
    const lw = wordWeight(left);
    // Candidate right words within tolerance of the left weight.
    const candidateWeights = [lw - 1, lw, lw + 1].filter((w) => byWeight.has(w));
    let matched: string | null = null;
    for (const cw of candidateWeights) {
      const pool = (byWeight.get(cw) ?? []).slice().sort((a, b) => fnv1a32(a + left) - fnv1a32(b + left));
      for (const right of pool) {
        if (right === left) continue;
        if (Math.abs(wordWeight(left) - wordWeight(right)) > TOLERANCE) continue;
        const rackLetters = letterMultiset(left + right);
        if (rackLetters.length < 6 || rackLetters.length > 12) continue;
        if (usedRacks.has(rackLetters)) continue;
        matched = right;
        // Build + gate.
        const rack: Tile[] = rackFromLetters(left + right);
        const raw: RawPuzzle = { rack, tolerance: TOLERANCE, guaranteedLeft: left, guaranteedRight: right };
        const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
        const p = buildPuzzle(id, raw, dictSet);
        if (p !== null) {
          assertPuzzleValid(raw, dictSet);
          puzzles.push(p);
          usedRacks.add(rackLetters);
        }
        break;
      }
      if (matched) break;
    }
  }

  if (puzzles.length < 4) throw new Error(`Tare: too few valid puzzles (${puzzles.length}).`);

  // Ship a compact validation dictionary: all words that could be formed from any
  // rack's letters would be large; instead ship the full 3-6 pool (already bounded).
  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    dictionary: words,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "tare.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`tare.json: ${puzzles.length} puzzles, ${words.length}-word dictionary`);
}

main();
