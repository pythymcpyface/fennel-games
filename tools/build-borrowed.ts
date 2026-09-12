import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/borrowed/content-build.ts";

// Build-time generator. Editorial etymology data (wordkit has no etymology source);
// the gate ensures 5 distinct words + every answer present in the options pool.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_borrowed_v1";
const LANGS = ["Japanese", "Swahili", "Hokkien", "Czech", "Italian", "French", "Spanish", "German", "Arabic", "Hindi", "Dutch", "Nahuatl", "Persian", "Turkish", "Russian"];

const SETS: CandidateSet[] = [
  { words: ["TSUNAMI", "SAFARI", "KETCHUP", "ROBOT", "PIANO"], answers: ["Japanese", "Swahili", "Hokkien", "Czech", "Italian"] },
  { words: ["TYCOON", "SUGAR", "BALLET", "PLAZA", "KINDERGARTEN"], answers: ["Japanese", "Arabic", "French", "Spanish", "German"] },
  { words: ["SHAMPOO", "TOMATO", "COOKIE", "SAUNA", "MOSQUITO"], answers: ["Hindi", "Nahuatl", "Dutch", "Finnish", "Spanish"] },
  { words: ["BAZAAR", "SOFA", "YOGURT", "TUNDRA", "GUITAR"], answers: ["Persian", "Arabic", "Turkish", "Russian", "Spanish"] },
  { words: ["KARAOKE", "JUNGLE", "CHOCOLATE", "WALTZ", "CAFE"], answers: ["Japanese", "Hindi", "Nahuatl", "German", "French"] },
];

function main(): void {
  // Add a couple of distractor languages to each set's option pool.
  const cands = SETS.map((s) => ({ ...s, extraOptions: LANGS.filter((l) => !s.answers.includes(l)).slice(0, 3) }));
  const puzzles = buildPuzzles(cands);
  assertPuzzlesValid(puzzles);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "borrowed.json"), json);
  // eslint-disable-next-line no-console
  console.log(`borrowed.json: ${puzzles.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
}

main();
