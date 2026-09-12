import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/homophone-heist/content-build.ts";

// Build-time generator. Editorial homophone data (wordkit has no homophone relations).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_homophone_v1";

// Homophone map (uppercase). shown token <-> intended answer.
const HOMOPHONES: Record<string, string[]> = {
  EYE: ["I", "AYE"], I: ["EYE"], FOUR: ["FOR", "FORE"], FOR: ["FOUR"], TWO: ["TO", "TOO"], TO: ["TWO", "TOO"],
  SEA: ["SEE", "C"], SEE: ["SEA"], BEE: ["BE"], BE: ["BEE"], KNIGHT: ["NIGHT"], NIGHT: ["KNIGHT"],
  WON: ["ONE"], ONE: ["WON"], ATE: ["EIGHT"], EIGHT: ["ATE"], WOOD: ["WOULD"], WOULD: ["WOOD"],
  HEAR: ["HERE"], HERE: ["HEAR"], KNOW: ["NO"], NO: ["KNOW"], BUY: ["BY", "BYE"], BY: ["BUY"],
  FLOUR: ["FLOWER"], FLOWER: ["FLOUR"], PLANE: ["PLAIN"], PLAIN: ["PLANE"], PAIR: ["PEAR", "PARE"],
  SCREAM: ["SCREAM"], CREAM: ["CREAM"], MADE: ["MADE"], DAY: ["DAY"],
};

const CANDIDATES: CandidatePuzzle[] = [
  { shownTokens: ["EYE", "SCREAM", "FOUR", "I", "SCREAM"], answers: ["I", "SCREAM", "FOR", "I", "SCREAM"] },
  { shownTokens: ["TWO", "BEE", "OR", "KNOT", "TWO"], answers: ["TO", "BE", "OR", "NOT", "TO"] },
  { shownTokens: ["EYE", "WON", "ATE"], answers: ["I", "ONE", "EIGHT"] },
  { shownTokens: ["SEA", "YOU", "THEIR"], answers: ["SEE", "YOU", "THERE"] },
  { shownTokens: ["KNIGHT", "AND", "DAY"], answers: ["NIGHT", "AND", "DAY"] },
];
// Extend map for tokens used above.
Object.assign(HOMOPHONES, {
  KNOT: ["NOT"], NOT: ["KNOT"], OR: ["OR"], YOU: ["YOU"], THEIR: ["THERE", "THEYRE"], THERE: ["THEIR"], AND: ["AND"],
});

function main(): void {
  const puzzles = buildPuzzles(CANDIDATES, HOMOPHONES);
  assertPuzzlesValid(puzzles, HOMOPHONES);
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", homophones: HOMOPHONES, puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "homophone-heist.json"), json);
  // eslint-disable-next-line no-console
  console.log(`homophone-heist.json: ${puzzles.length}/${CANDIDATES.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
  const dropped = CANDIDATES.length - puzzles.length;
  if (dropped > 0) console.log(`  NOTE: ${dropped} dropped (a shown token was not a homophone of its answer).`);
}

main();
