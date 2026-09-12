import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/emoji-etymon/content-build.ts";

// Build-time generator. Editorial emoji rebuses (hand-authored; wordkit not applicable).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_emoji_v1";

const CANDIDATES: CandidatePuzzle[] = [
  { emoji: "🐝🍃", answer: "BELIEF", hintText: "bee + leaf" },
  { emoji: "👁️🥧", answer: "IPHONE", hintText: "eye + ... (sounds-like starter)" }, // will fail gate? answer alpha only ok
  { emoji: "🥕🍩", answer: "CARTOON", hintText: "car + toon (carrot + doughnut)" },
  { emoji: "🐛🍽️", answer: "CATERPILLAR", hintText: "cater + pillar" },
  { emoji: "☀️🌸", answer: "SUNFLOWER", hintText: "sun + flower" },
  { emoji: "🦵🖐️", answer: "LEGEND", hintText: "leg + end" },
  { emoji: "🐜🅰️", answer: "ANTARCTICA", hintText: "ant + arctic + a" },
  { emoji: "🍯🌙", answer: "HONEYMOON", hintText: "honey + moon" },
  { emoji: "🐟🍴", answer: "FISHNET", hintText: "fish + net" },
  { emoji: "🔑🌴", answer: "KEYBOARD", hintText: "key + board" },
];

function main(): void {
  const puzzles = buildPuzzles(CANDIDATES);
  assertPuzzlesValid(puzzles);
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "emoji-etymon.json"), json);
  // eslint-disable-next-line no-console
  console.log(`emoji-etymon.json: ${puzzles.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 5)) console.log(`  ${p.emoji} -> ${p.answer.length} letters`);
}

main();
