import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/stress-test/content-build.ts";

// Build-time generator. Editorial stress data (wordkit has no stress marks).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_stress_v1";

const SETS: CandidateSet[] = [
  { items: [
    { word: "RECORD", syllables: ["RE", "CORD"], stressedIndex: 0, sense: "a disc" },
    { word: "PRESENT", syllables: ["PRE", "SENT"], stressedIndex: 0, sense: "a gift" },
    { word: "OBJECT", syllables: ["OB", "JECT"], stressedIndex: 0, sense: "a thing" },
    { word: "CONTEST", syllables: ["CON", "TEST"], stressedIndex: 0, sense: "a competition" },
    { word: "PERMIT", syllables: ["PER", "MIT"], stressedIndex: 0, sense: "a licence" },
  ] },
  { items: [
    { word: "BANANA", syllables: ["BA", "NA", "NA"], stressedIndex: 1 },
    { word: "COMPUTER", syllables: ["COM", "PU", "TER"], stressedIndex: 1 },
    { word: "ELEPHANT", syllables: ["EL", "E", "PHANT"], stressedIndex: 0 },
    { word: "TOMORROW", syllables: ["TO", "MOR", "ROW"], stressedIndex: 1 },
    { word: "UMBRELLA", syllables: ["UM", "BREL", "LA"], stressedIndex: 1 },
  ] },
];

function main(): void {
  const puzzles = buildPuzzles(SETS);
  assertPuzzlesValid(puzzles);
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "stress-test.json"), json);
  // eslint-disable-next-line no-console
  console.log(`stress-test.json: ${puzzles.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
}

main();
