import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/rhyme-chain/content-build.ts";
import type { RhymeDict } from "../src/games/rhyme-chain/types.ts";

// Build-time generator (JOURNEY-005). Emits public/rhyme-chain.json.
// Rime keys are hand-tagged for the MVP vocabulary; swap in CMUdict later.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_rhymes_v1";

const DICT: RhymeDict = {
  light: " AIT", right: "AIT", kite: "AIT", night: "AIT", sight: "AIT", flight: "AIT",
  cat: "AT", hat: "AT", bat: "AT", mat: "AT", rat: "AT",
  cake: "AKE", lake: "AKE", snake: "AKE", rake: "AKE",
  star: "AR", car: "AR", jar: "AR", far: "AR",
  moon: "OON", spoon: "OON", balloon: "OON", tune: "OON",
  bell: "ELL", shell: "ELL", well: "ELL", spell: "ELL",
  tree: "EE", bee: "EE", sea: "EE", key: "EE",
  rain: "AIN", train: "AIN", chain: "AIN", brain: "AIN",
};
// normalize keys (strip stray spaces)
for (const k of Object.keys(DICT)) DICT[k] = DICT[k].trim();

const CLUE_INDEX: Record<string, string[]> = {
  "opposite of wrong": ["right"],
  "a flying toy on a string": ["kite"],
  "the dark part of the day": ["night"],
  "a small purring pet": ["cat"],
  "you wear it on your head": ["hat"],
  "a slice of it for your birthday": ["cake"],
  "a body of still water": ["lake"],
  "a legless reptile": ["snake"],
  "twinkles in the night sky": ["star"],
  "you drive it": ["car"],
  "earth's natural satellite": ["moon"],
  "you eat soup with it": ["spoon"],
  "it rings in a tower": ["bell"],
  "you find the sea in it": ["shell"],
  "a tall leafy plant": ["tree"],
  "it makes honey": ["bee"],
  "falls from clouds": ["rain"],
  "runs on tracks": ["train"],
};

const CANDIDATES: CandidatePuzzle[] = [
  { seedWord: "light", slots: [{ clue: "opposite of wrong", answer: "right" }, { clue: "a flying toy on a string", answer: "kite" }, { clue: "the dark part of the day", answer: "night" }] },
  { seedWord: "sat", slots: [{ clue: "a small purring pet", answer: "cat" }, { clue: "you wear it on your head", answer: "hat" }] },
  { seedWord: "bake", slots: [{ clue: "a slice of it for your birthday", answer: "cake" }, { clue: "a body of still water", answer: "lake" }, { clue: "a legless reptile", answer: "snake" }] },
  { seedWord: "bar", slots: [{ clue: "twinkles in the night sky", answer: "star" }, { clue: "you drive it", answer: "car" }] },
  { seedWord: "soon", slots: [{ clue: "earth's natural satellite", answer: "moon" }, { clue: "you eat soup with it", answer: "spoon" }] },
  { seedWord: "fell", slots: [{ clue: "it rings in a tower", answer: "bell" }, { clue: "you find the sea in it", answer: "shell" }] },
  { seedWord: "free", slots: [{ clue: "a tall leafy plant", answer: "tree" }, { clue: "it makes honey", answer: "bee" }] },
  { seedWord: "pain", slots: [{ clue: "falls from clouds", answer: "rain" }, { clue: "runs on tracks", answer: "train" }] },
];
// seeds must be in the dict with matching rime
Object.assign(DICT, { sat: "AT", bake: "AKE", bar: "AR", soon: "OON", fell: "ELL", free: "EE", pain: "AIN" });

function main(): void {
  const puzzles = buildPuzzles(CANDIDATES, DICT, CLUE_INDEX);
  assertPuzzlesValid(puzzles, DICT, CLUE_INDEX);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC",
    rhymeDict: DICT,
    puzzles,
  };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "rhyme-chain.json"), json);
  // eslint-disable-next-line no-console
  console.log(`rhyme-chain.json: ${puzzles.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 4)) {
    // eslint-disable-next-line no-console
    console.log(`  ${p.seedWord} -> ${p.slots.map((s) => s.answer).join(" -> ")}`);
  }
}

main();
