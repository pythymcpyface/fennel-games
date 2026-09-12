import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/compound-split/content-build.ts";

// Build-time generator. Editorial compound splits (wordkit has no compound-split
// list). The uniqueness gate guarantees each 8-half set has exactly one matching.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_compound_v1";

const CANDIDATES: CandidatePuzzle[] = [
  { compounds: [{ left: "SUN", right: "FLOWER" }, { left: "RAIN", right: "BOW" }, { left: "MOON", right: "LIGHT" }, { left: "FIRE", right: "FLY" }] },
  { compounds: [{ left: "FOOT", right: "BALL" }, { left: "KEY", right: "BOARD" }, { left: "TOOTH", right: "BRUSH" }, { left: "NOTE", right: "BOOK" }] },
  { compounds: [{ left: "SNOW", right: "MAN" }, { left: "BUTTER", right: "CUP" }, { left: "GOLD", right: "FISH" }, { left: "PLAY", right: "GROUND" }] },
  { compounds: [{ left: "BED", right: "ROOM" }, { left: "WATER", right: "FALL" }, { left: "SEA", right: "SHELL" }, { left: "TEA", right: "POT" }] },
  { compounds: [{ left: "BLACK", right: "BIRD" }, { left: "NEWS", right: "PAPER" }, { left: "SAND", right: "CASTLE" }, { left: "DAY", right: "DREAM" }] },
  { compounds: [{ left: "STAR", right: "DUST" }, { left: "HORSE", right: "SHOE" }, { left: "PANCAKE", right: "S" }, { left: "RAIN", right: "COAT" }] },
];

function main(): void {
  const puzzles = buildPuzzles(CANDIDATES);
  assertPuzzlesValid(puzzles);
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "compound-split.json"), json);
  // eslint-disable-next-line no-console
  console.log(`compound-split.json: ${puzzles.length}/${CANDIDATES.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
  const dropped = CANDIDATES.length - puzzles.length;
  if (dropped > 0) console.log(`  NOTE: ${dropped} set(s) dropped (ambiguous perfect matching).`);
}

main();
