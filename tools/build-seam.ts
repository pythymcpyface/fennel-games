import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid } from "../src/games/seam/content-build.ts";
import type { Puzzle } from "../src/games/seam/types.ts";

// Seam build tool. Curated word chains where each CONSECUTIVE pair forms a real
// compound/collocation (e.g. FIRE-FLY-PAPER-BACK-BONE). The engine defines valid
// links as the solution's consecutive pairs, and the fairness gate guarantees the
// ordering is unique up to reversal. Chains are hand-authored for link quality.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "seam.curated.v1";

// Each chain: consecutive words form a compound or strong collocation.
const CHAINS: string[][] = [
  ["FIRE", "FLY", "PAPER", "BACK", "BONE"],
  ["SUN", "FLOWER", "POT", "LUCK", "DRAW"],
  ["RAIN", "BOW", "TIE", "BREAK", "DOWN"],
  ["FOOT", "BALL", "PARK", "BENCH", "MARK"],
  ["MOON", "LIGHT", "HOUSE", "WORK", "SHOP"],
  ["SNOW", "BALL", "ROOM", "MATE", "SHIP"],
  ["KEY", "BOARD", "WALK", "WAY", "SIDE"],
  ["TOOTH", "BRUSH", "FIRE", "WOOD", "LAND"],
  ["BASE", "BALL", "GAME", "PLAN", "NET"],
  ["BLACK", "BIRD", "BATH", "TUB", "THUMP"],
  ["WATER", "FALL", "OUT", "SIDE", "WALK"],
  ["HAND", "BAG", "PIPE", "LINE", "UP"],
  ["HORSE", "SHOE", "LACE", "WORK", "OUT"],
  ["NEWS", "PAPER", "CLIP", "BOARD", "GAME"],
  ["STAR", "FISH", "HOOK", "UP", "GRADE"],
  ["GOLD", "FISH", "TANK", "TOP", "COAT"],
  ["COW", "BOY", "SCOUT", "MASTER", "MIND"],
  ["DAY", "LIGHT", "BULB", "HORN", "PIPE"],
  ["DOOR", "BELL", "HOP", "SCOTCH", "TAPE"],
  ["TEA", "CUP", "CAKE", "WALK", "OVER"],
];

function scrambleFor(seedStr: string): (n: number) => number[] {
  return (n: number) => {
    // Deterministic Fisher-Yates using an FNV-seeded LCG.
    const arr = Array.from({ length: n }, (_, i) => i);
    let seed = fnv1a32(seedStr) >>> 0;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // Ensure it's actually scrambled (not the identity or its reverse) for n>2.
    const ident = Array.from({ length: n }, (_, i) => i);
    if (n > 2 && (arr.join() === ident.join() || arr.join() === [...ident].reverse().join())) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr;
  };
}

function main(): void {
  const puzzles: Puzzle[] = [];
  for (const chain of CHAINS) {
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(chain, id, scrambleFor(chain.join("-")));
    if (p === null) {
      // eslint-disable-next-line no-console
      console.warn(`skipped non-unique chain: ${chain.join("-")}`);
      continue;
    }
    assertPuzzleValid(p);
    puzzles.push(p);
  }
  if (puzzles.length < 15) throw new Error(`Seam: too few valid chains (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "seam.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`seam.json: ${puzzles.length} puzzles`);
}

main();
