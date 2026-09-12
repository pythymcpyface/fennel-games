import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/antonym-bridge/content-build.ts";

// Build-time generator. Curated antonym graph (wordkit has no antonym relations).
// Chains are engineered so multi-hop bridges exist (e.g. GIANT->TINY->HUGE... via
// shared intermediate antonyms).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_antonym_v1";

// Undirected antonym edges (listed once). Intermediate words create 2-3 hop bridges.
const ANTONYMS: Record<string, string[]> = {
  HOT: ["COLD"], COLD: ["HOT", "WARM"], WARM: ["COOL", "COLD"], COOL: ["WARM"],
  BIG: ["SMALL"], SMALL: ["BIG", "LARGE"], LARGE: ["TINY", "SMALL"], TINY: ["HUGE", "LARGE"], HUGE: ["TINY"],
  FAST: ["SLOW"], SLOW: ["FAST", "QUICK"], QUICK: ["SLUGGISH", "SLOW"], SLUGGISH: ["QUICK"],
  HAPPY: ["SAD"], SAD: ["HAPPY", "GLAD"], GLAD: ["GLOOMY", "SAD"], GLOOMY: ["GLAD"],
  LIGHT: ["DARK", "HEAVY"], DARK: ["LIGHT", "BRIGHT"], BRIGHT: ["DIM", "DARK"], DIM: ["BRIGHT"], HEAVY: ["LIGHT"],
  WET: ["DRY"], DRY: ["WET", "MOIST"], MOIST: ["DRY", "ARID"], ARID: ["MOIST"],
  HARD: ["SOFT", "EASY"], SOFT: ["HARD", "FIRM"], FIRM: ["LIMP", "SOFT"], LIMP: ["FIRM"], EASY: ["HARD"],
};

const CANDIDATES: CandidatePuzzle[] = [
  { startWord: "HUGE", targetWord: "LARGE", moveBudget: 4 }, // HUGE-TINY-LARGE (2)
  { startWord: "HOT", targetWord: "COOL", moveBudget: 4 }, // HOT-COLD-WARM-COOL (3)
  { startWord: "FAST", targetWord: "SLUGGISH", moveBudget: 4 }, // FAST-SLOW-QUICK-SLUGGISH (3)
  { startWord: "HAPPY", targetWord: "GLOOMY", moveBudget: 4 }, // HAPPY-SAD-GLAD-GLOOMY (3)
  { startWord: "LIGHT", targetWord: "BRIGHT", moveBudget: 4 }, // LIGHT-DARK-BRIGHT (2)
  { startWord: "WET", targetWord: "ARID", moveBudget: 4 }, // WET-DRY-MOIST-ARID (3)
  { startWord: "HARD", targetWord: "LIMP", moveBudget: 4 }, // HARD-SOFT-FIRM-LIMP (3)
];

function main(): void {
  const puzzles = buildPuzzles(CANDIDATES, ANTONYMS);
  assertPuzzlesValid(puzzles);
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "antonym-bridge.json"), json);
  // eslint-disable-next-line no-console
  console.log(`antonym-bridge.json: ${puzzles.length}/${CANDIDATES.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles) console.log(`  ${p.startWord} -> ${p.targetWord}`);
}

main();
