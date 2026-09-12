import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly } from "../wordkit/src/index.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidatePair } from "../src/games/kerning/content-build.ts";


// Build-time generator. Uses @cic/wordkit corpus as the segmentation dictionary; the
// gate verifies each run has EXACTLY two multi-token readings (A shown, B target).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_kerning_v1";

const PAIRS: CandidatePair[] = [
  { readingA: "NOW HERE", readingB: "NO WHERE" },
  { readingA: "WERE WOLF", readingB: "WE REWOLF" }, // likely rejected (REWOLF not a word) - gate handles
  { readingA: "A NY WAY", readingB: "ANY WAY" },
  { readingA: "IN TO", readingB: "IN TO" }, // same -> rejected
  { readingA: "MAN SLAUGHTER", readingB: "MANS LAUGHTER" },
  { readingA: "THE RAPIST", readingB: "THERA PIST" },
  { readingA: "PEN IS", readingB: "PE NIS" },
  { readingA: "HE ART", readingB: "HEAR T" },
];

function main(): void {
  const dictionary = new Set(filterAlphaOnly(loadCorpus({ maxTier: 55 })).map((w) => w.toUpperCase()));
  const puzzles = buildPuzzles(PAIRS, dictionary);
  assertPuzzlesValid(puzzles);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  // Ship the dictionary words needed to tokenize each run (both readings' tokens).
  const words = new Set<string>();
  for (const p of puzzles) {
    for (const mask of [p.shownMask, p.targetMask]) {
      let start = 0;
      for (let i = 0; i < mask.length; i++) if (mask[i]) { words.add(p.letterRun.slice(start, i + 1)); start = i + 1; }
      words.add(p.letterRun.slice(start));
    }
  }
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", dictionary: [...words].sort(), puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "kerning.json"), json);
  // eslint-disable-next-line no-console
  console.log(`kerning.json: ${puzzles.length}/${PAIRS.length} pairs passed, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles) {
    const showA = (phrase: boolean[]) => { let s = ""; for (let i = 0; i < p.letterRun.length; i++) { s += p.letterRun[i]; if (i < phrase.length && phrase[i]) s += " "; } return s; };
    console.log(`  ${showA(p.shownMask)}  ->  ${showA(p.targetMask)}`);
  }
  const dropped = PAIRS.length - puzzles.length;
  if (dropped > 0) console.log(`  NOTE: ${dropped} pair(s) dropped (not exactly two multi-token readings, or A==B, or non-words).`);
}

main();
