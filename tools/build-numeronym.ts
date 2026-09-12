import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly } from "../wordkit/src/index.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/numeronym/content-build.ts";

// Build-time generator. Uses @cic/wordkit corpus as the validation dictionary; the
// build gate verifies each clue is a genuine, unique encoding of its answer.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_numeronym_v1";

// Each answer genuinely contains a sound-alike fragment (ATE->8, FOR->4, TO->2, etc).
const SETS: CandidateSet[] = [
  { items: [
    { clue: "L8R", answer: "LATER" }, { clue: "GR8", answer: "GRATE" }, { clue: "CRE8", answer: "CREATE" },
    { clue: "SK8", answer: "SKATE" }, { clue: "DON8", answer: "DONATE" },
  ], themeLabel: "-ate words" },
  { items: [
    { clue: "4GE", answer: "FORGE" }, { clue: "4TUNE", answer: "FORTUNE" }, { clue: "4MAT", answer: "FORMAT" },
    { clue: "4WARD", answer: "FORWARD" }, { clue: "4EST", answer: "FOREST" },
  ], themeLabel: "for- words" },
  { items: [
    { clue: "2NIGHT", answer: "TONIGHT" }, { clue: "2GETHER", answer: "TOGETHER" }, { clue: "2MATO", answer: "TOMATO" },
    { clue: "2KEN", answer: "TOKEN" }, { clue: "2PAZ", answer: "TOPAZ" },
  ], themeLabel: "to- words" },
];

function main(): void {
  const dictionary = new Set(filterAlphaOnly(loadCorpus({ maxTier: 55 })).map((w) => w.toUpperCase()));
  for (const s of SETS) for (const it of s.items) dictionary.add(it.answer.toUpperCase());

  const puzzles = buildPuzzles(SETS, dictionary);
  assertPuzzlesValid(puzzles, dictionary);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const runtimeDict = [...new Set(puzzles.flatMap((p) => p.answers))].sort();
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", dictionary: runtimeDict, puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "numeronym.json"), json);
  // eslint-disable-next-line no-console
  console.log(`numeronym.json: ${puzzles.length}/${SETS.length} sets passed, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles) console.log(`  [${p.themeLabel}] ${p.clues.join(" ")}`);
  const dropped = SETS.length - puzzles.length;
  if (dropped > 0) console.log(`  NOTE: ${dropped} set(s) dropped (a clue was not a unique encoding of its answer).`);
}

main();
