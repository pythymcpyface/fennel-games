import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/degrees/content-build.ts";

// Build-time generator. Curated intensity scales (editorial — no wordkit needed;
// intensity ordering is a human judgement, not derivable from a frequency list).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_degrees_v1";

// Words listed weakest -> strongest (canonical order).
const SETS: CandidateSet[] = [
  { words: ["cool", "tepid", "warm", "hot", "scorching"], scaleLabel: "temperature" },
  { words: ["tiny", "small", "medium", "large", "huge"], scaleLabel: "size" },
  { words: ["whisper", "murmur", "talk", "shout", "scream"], scaleLabel: "loudness" },
  { words: ["drizzle", "shower", "rain", "downpour", "deluge"], scaleLabel: "rainfall" },
  { words: ["glad", "happy", "joyful", "elated", "ecstatic"], scaleLabel: "happiness" },
  { words: ["annoyed", "cross", "angry", "furious", "livid"], scaleLabel: "anger" },
  { words: ["cool", "chilly", "cold", "freezing", "frigid"], scaleLabel: "coldness" },
  { words: ["damp", "moist", "wet", "soaked", "drenched"], scaleLabel: "wetness" },
  { words: ["dim", "faint", "bright", "brilliant", "blazing"], scaleLabel: "brightness" },
  { words: ["nibble", "eat", "gobble", "devour", "gorge"], scaleLabel: "eating intensity" },
  { words: ["jog", "run", "sprint", "dash", "bolt"], scaleLabel: "running speed" },
  { words: ["good", "great", "excellent", "superb", "perfect"], scaleLabel: "quality" },
];

function main(): void {
  const puzzles = buildPuzzles(SETS);
  assertPuzzlesValid(puzzles);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "degrees.json"), json);
  // eslint-disable-next-line no-console
  console.log(`degrees.json: ${puzzles.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 4)) {
    // eslint-disable-next-line no-console
    console.log(`  [${p.scaleLabel}] ${p.words.join(" < ")}`);
  }
}

main();
