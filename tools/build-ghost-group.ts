import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid } from "../src/games/ghost-group/content-build.ts";
import type { Puzzle } from "../src/games/ghost-group/types.ts";

// Ghost Group build tool. Curated 16-word boards: 4 themed groups of 4. One group
// per board is the ghost; ghost-label candidates are drawn from other boards'
// labels + the correct one. Deterministic scramble of tile positions.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "ghost-group.curated.v1";

// Each board: 4 groups {label, 4 words}. The 3rd index (ghostIndex) marks the ghost.
const BOARDS: Array<{ groups: Array<{ label: string; words: string[] }>; ghostIndex: number }> = [
  { ghostIndex: 3, groups: [
    { label: "Planets", words: ["MARS", "VENUS", "SATURN", "NEPTUNE"] },
    { label: "Dances", words: ["SALSA", "TANGO", "WALTZ", "RUMBA"] },
    { label: "Chess pieces", words: ["ROOK", "KNIGHT", "BISHOP", "PAWN"] },
    { label: "___ board", words: ["CHESS", "KEY", "SURF", "DASH"] },
  ] },
  { ghostIndex: 3, groups: [
    { label: "Citrus fruit", words: ["LEMON", "LIME", "ORANGE", "CITRON"] },
    { label: "Big cats", words: ["LION", "TIGER", "JAGUAR", "COUGAR"] },
    { label: "Card games", words: ["POKER", "BRIDGE", "HEARTS", "RUMMY"] },
    { label: "Car brands", words: ["JAGUAR-CAR", "MERCURY", "SATURN-CAR", "LOTUS"] },
  ] },
  { ghostIndex: 2, groups: [
    { label: "Shades of red", words: ["CRIMSON", "SCARLET", "RUBY", "CHERRY"] },
    { label: "Body parts", words: ["SHIN", "ELBOW", "ANKLE", "WRIST"] },
    { label: "Homophones of numbers", words: ["ATE", "WON", "TOO", "FORE"] },
    { label: "Baseball terms", words: ["PITCH", "BUNT", "STEAL", "SLIDE"] },
  ] },
  { ghostIndex: 0, groups: [
    { label: "Greek letters", words: ["ALPHA", "DELTA", "SIGMA", "OMEGA"] },
    { label: "Rivers", words: ["NILE", "AMAZON", "THAMES", "DANUBE"] },
    { label: "Coffee drinks", words: ["LATTE", "MOCHA", "ESPRESSO", "AMERICANO"] },
    { label: "Constellations", words: ["ORION", "LYRA", "DRACO", "HYDRA"] },
  ] },
  { ghostIndex: 1, groups: [
    { label: "Board games", words: ["CLUEDO", "RISK", "SORRY", "TROUBLE"] },
    { label: "Emotions", words: ["ANGER", "JOY", "FEAR", "DISGUST"] },
    { label: "Trees", words: ["OAK", "BIRCH", "MAPLE", "CEDAR"] },
    { label: "Units of time", words: ["SECOND", "MINUTE", "DECADE", "EPOCH"] },
  ] },
  { ghostIndex: 3, groups: [
    { label: "Metals", words: ["IRON", "COPPER", "NICKEL", "COBALT"] },
    { label: "Pizza toppings", words: ["OLIVE", "PEPPER", "ONION", "BASIL"] },
    { label: "Zodiac signs", words: ["ARIES", "LEO", "VIRGO", "LIBRA"] },
    { label: "Monopoly tokens", words: ["THIMBLE", "BOOT", "TOPHAT", "CANNON"] },
  ] },
];

function scrambleFor(seedStr: string): (n: number) => number[] {
  return (n: number) => {
    const arr = Array.from({ length: n }, (_, i) => i);
    let seed = fnv1a32(seedStr) >>> 0;
    for (let i = n - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = Math.floor((seed / 0x100000000) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
}

function main(): void {
  const allLabels = BOARDS.flatMap((b) => b.groups.map((g) => g.label));
  const puzzles: Puzzle[] = [];
  for (const board of BOARDS) {
    const ghostLabel = board.groups[board.ghostIndex].label;
    // Candidates: correct ghost label + 3 distractor labels from other boards.
    const distractors = allLabels
      .filter((l) => l !== ghostLabel && !board.groups.some((g) => g.label === l))
      .sort((a, b) => fnv1a32(a + ghostLabel) - fnv1a32(b + ghostLabel))
      .slice(0, 3);
    const candidates = [ghostLabel, ...distractors].sort((a, b) => fnv1a32(a) - fnv1a32(b));
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(board.groups, board.ghostIndex, candidates, id, scrambleFor(id + ghostLabel));
    if (p === null) {
      // eslint-disable-next-line no-console
      console.warn(`skipped unfair board: ${ghostLabel}`);
      continue;
    }
    assertPuzzleValid(p);
    puzzles.push(p);
  }
  if (puzzles.length < 4) throw new Error(`Ghost Group: too few valid boards (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "ghost-group.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`ghost-group.json: ${puzzles.length} puzzles`);
}

main();
