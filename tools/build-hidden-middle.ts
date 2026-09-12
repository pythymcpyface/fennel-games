import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly } from "../wordkit/src/index.ts";
import { buildPuzzles, assertPuzzlesValid, dictionarySubstrings, type CandidatePuzzle } from "../src/games/hidden-middle/content-build.ts";

// Build-time generator (JOURNEY-006), wired to @cic/wordkit. The membership
// dictionary is the real en-GB corpus, so the fairness gate (clue maps to exactly one
// dictionary-word substring of the carrier) runs against a large, realistic lexicon
// rather than a hand-tuned list. Curated answers are added in case any sits below the
// common-tier cutoff. wordkit never ships — only the derived pack does.

const PACK_VERSION = "1.1.0"; // bumped: dictionary source changed (deterministic-stability)
const DATASET_ID = "en_hidden_v2";

const CURATED_ANSWERS = [
  "SCAN", "CAT", "BREAD", "HEART", "PLANET", "MOTHER", "ORANGE", "PIN", "GRAND", "PET", "WINDOW", "FLOWER",
];
const DICT = new Set<string>(filterAlphaOnly(loadCorpus({ maxTier: 55 })).map((w) => w.toUpperCase()));
for (const w of CURATED_ANSWERS) DICT.add(w);

// clue -> intended answer(s). Gate requires exactly one to be a dict-substring of carrier.
const CLUE_INDEX: Record<string, string[]> = {
  "a quick look": ["SCAN"],
  "a domesticated feline": ["CAT"],
  "a loaf staple": ["BREAD"],
  "the organ that beats": ["HEART"],
  "a world with orbits": ["PLANET"],
  "your female parent": ["MOTHER"],
  "a citrus fruit": ["ORANGE"],
  "a sharp fastener": ["PIN"],
  "big and impressive": ["GRAND"],
  "an animal companion": ["PET"],
  "you see through it": ["WINDOW"],
  "a blossom": ["FLOWER"],
};

const CANDIDATES: CandidatePuzzle[] = [
  { carrierWord: "SCANDALOUS", clue: "a quick look", answerWord: "SCAN" },
  { carrierWord: "CATALOG", clue: "a domesticated feline", answerWord: "CAT" },
  { carrierWord: "BREADTH", clue: "a loaf staple", answerWord: "BREAD" },
  { carrierWord: "HEARTH", clue: "the organ that beats", answerWord: "HEART" },
  { carrierWord: "PLANETARY", clue: "a world with orbits", answerWord: "PLANET" },
  { carrierWord: "SMOTHER", clue: "your female parent", answerWord: "MOTHER" },
  { carrierWord: "ORANGERY", clue: "a citrus fruit", answerWord: "ORANGE" },
  { carrierWord: "SPINDLE", clue: "a sharp fastener", answerWord: "PIN" },
  { carrierWord: "GRANDEUR", clue: "big and impressive", answerWord: "GRAND" },
  { carrierWord: "CARPET", clue: "an animal companion", answerWord: "PET" },
  { carrierWord: "WINDOWPANE", clue: "you see through it", answerWord: "WINDOW" },
  { carrierWord: "FLOWERBED", clue: "a blossom", answerWord: "FLOWER" },
];

function main(): void {
  const puzzles = buildPuzzles(CANDIDATES, DICT, CLUE_INDEX);
  assertPuzzlesValid(puzzles, DICT, CLUE_INDEX);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  // Ship a compact runtime dictionary: every real-word substring of each carrier
  // (so "inside + is a word" feedback is accurate) plus the answers. Avoids bundling
  // the whole corpus while keeping feedback honest.
  const runtimeDict = new Set<string>();
  for (const p of puzzles) {
    runtimeDict.add(p.answerWord);
    for (const sub of dictionarySubstrings(p.carrierWord, DICT)) runtimeDict.add(sub);
  }
  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC",
    dictionary: [...runtimeDict].sort(),
    puzzles,
  };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "hidden-middle.json"), json);
  // eslint-disable-next-line no-console
  console.log(`hidden-middle.json: ${puzzles.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 5)) {
    const subs = dictionarySubstrings(p.carrierWord, DICT);
    // eslint-disable-next-line no-console
    console.log(`  ${p.carrierWord} -> ${p.answerWord} (subs: ${subs.join(",")})`);
  }
  if (puzzles.length < CANDIDATES.length) {
    // eslint-disable-next-line no-console
    console.log(`  NOTE: ${CANDIDATES.length - puzzles.length} candidate(s) rejected by the fairness gate.`);
  }
}

main();
