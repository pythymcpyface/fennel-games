import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzles, assertPuzzlesValid, isFairPair } from "../src/games/mirrorle/content-build.ts";

// Mirrorle build tool. Ground-truth data only (wordkit SCOWL en-GB corpus).
// - dictionary: common 5-letter words used to validate guesses AND source secrets.
// - puzzles: deterministically-selected fair pairs (via the content-build gate).
// The two secrets never ship separately from the pack; the aggregated-feedback
// scoring is a pure function of the pair, so no model is needed at runtime.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const PUZZLES = 120;
// answer pool: reasonably common 5-letter words (lower tier = more common).
const ANSWER_MAX_TIER = 40;
// guess dictionary: a broader set of 5-letter words (accept more, source fewer).
const GUESS_MAX_TIER = 60;

function main(): void {
  const fiveAnswers = filterByLength(
    filterAlphaOnly(loadCorpus({ maxTier: ANSWER_MAX_TIER, lengths: [5, 5] })),
    5,
    5,
  ).map((w) => w.toUpperCase());
  const fiveGuesses = filterByLength(
    filterAlphaOnly(loadCorpus({ maxTier: GUESS_MAX_TIER, lengths: [5, 5] })),
    5,
    5,
  ).map((w) => w.toUpperCase());

  const answerSet = new Set(fiveAnswers);
  // Guess dictionary is the union so every secret is a valid guess too.
  const dictionary = Array.from(new Set([...fiveGuesses, ...fiveAnswers])).sort();

  // Deterministically enumerate candidate pairs. To keep it bounded and fair, pair
  // each answer with a deterministically-chosen partner and keep the fair ones.
  const sortedAnswers = [...fiveAnswers].sort((a, b) => fnv1a32(a) - fnv1a32(b));
  const pairs: Array<[string, string]> = [];
  const seenKeys = new Set<string>();
  for (let i = 0; i < sortedAnswers.length && pairs.length < PUZZLES * 4; i++) {
    const a = sortedAnswers[i];
    // try several deterministic partners spread across the list
    for (let step = 1; step <= 8 && pairs.length < PUZZLES * 4; step++) {
      const j = (i + step * 137) % sortedAnswers.length;
      const b = sortedAnswers[j];
      const key = [a, b].sort().join("-");
      if (seenKeys.has(key)) continue;
      if (isFairPair(a, b)) {
        seenKeys.add(key);
        pairs.push([a, b]);
      }
    }
  }

  const puzzles = buildPuzzles(pairs, answerSet).slice(0, PUZZLES);
  assertPuzzlesValid(puzzles, answerSet);
  if (puzzles.length < 30) {
    throw new Error(`Mirrorle: too few fair puzzles generated (${puzzles.length}); loosen the gate.`);
  }

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    dictionary,
    puzzles,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "mirrorle.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`mirrorle.json: ${puzzles.length} puzzles, ${dictionary.length} dict words`);
}

main();
