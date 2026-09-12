import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/loan-ledger/content-build.ts";

// Build-time generator. Editorial morpheme data (wordkit has no morpheme glosses).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_loanledger_v1";

const DISTRACTORS = ["fear of heights", "study of stars", "lover of art", "measurer of heat", "study of life", "fear of crowds"];

const SETS: CandidateSet[] = [
  { items: [
    { word: "HYDROPHOBIA", morphemes: [{ part: "HYDRO", gloss: "water" }, { part: "PHOBIA", gloss: "fear" }], answer: "fear of water" },
    { word: "BIBLIOPHILE", morphemes: [{ part: "BIBLIO", gloss: "book" }, { part: "PHILE", gloss: "lover" }], answer: "lover of books" },
    { word: "CHRONOMETER", morphemes: [{ part: "CHRONO", gloss: "time" }, { part: "METER", gloss: "measure" }], answer: "measurer of time" },
    { word: "GEOLOGY", morphemes: [{ part: "GEO", gloss: "earth" }, { part: "LOGY", gloss: "study" }], answer: "study of the earth" },
    { word: "CARDIOLOGY", morphemes: [{ part: "CARDIO", gloss: "heart" }, { part: "LOGY", gloss: "study" }], answer: "study of the heart" },
  ] },
  { items: [
    { word: "ASTRONOMY", morphemes: [{ part: "ASTRO", gloss: "star" }, { part: "NOMY", gloss: "law/study" }], answer: "study of stars" },
    { word: "THERMOMETER", morphemes: [{ part: "THERMO", gloss: "heat" }, { part: "METER", gloss: "measure" }], answer: "measurer of heat" },
    { word: "BIOLOGY", morphemes: [{ part: "BIO", gloss: "life" }, { part: "LOGY", gloss: "study" }], answer: "study of life" },
    { word: "ACROPHOBIA", morphemes: [{ part: "ACRO", gloss: "height" }, { part: "PHOBIA", gloss: "fear" }], answer: "fear of heights" },
    { word: "PHILANTHROPY", morphemes: [{ part: "PHIL", gloss: "love" }, { part: "ANTHROP", gloss: "human" }], answer: "love of humankind" },
  ] },
];

function main(): void {
  const cands = SETS.map((s) => ({ ...s, extraOptions: DISTRACTORS.filter((d) => !s.items.some((it) => it.answer === d)).slice(0, 3) }));
  const puzzles = buildPuzzles(cands);
  assertPuzzlesValid(puzzles);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "loan-ledger.json"), json);
  // eslint-disable-next-line no-console
  console.log(`loan-ledger.json: ${puzzles.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
}

main();
