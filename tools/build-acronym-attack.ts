import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly } from "../wordkit/src/index.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/acronym-attack/content-build.ts";

// Build-time generator wired to @cic/wordkit. Uses the corpus both as the runtime
// validation dictionary and to prove each acronym is solvable (a word per initial).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_acronym_v1";

const CANDIDATES: CandidatePuzzle[] = [
  { acronym: "MOON", theme: "Space" },
  { acronym: "STAR", theme: "Space" },
  { acronym: "FIRE", theme: "Elements" },
  { acronym: "WAVE", theme: "Ocean" },
  { acronym: "LEAF", theme: "Nature" },
  { acronym: "GOLD", theme: "Treasure" },
  { acronym: "RAIN", theme: "Weather" },
  { acronym: "BEAT", theme: "Music" },
  { acronym: "CODE", theme: "Tech" },
  { acronym: "MIND", theme: "Thought" },
];

function main(): void {
  const words = filterAlphaOnly(loadCorpus({ maxTier: 55 })).map((w) => w.toUpperCase());
  const dictionary = new Set(words);
  const wordsByInitial: Record<string, string[]> = {};
  for (const w of words) (wordsByInitial[w[0]] ??= []).push(w);

  const puzzles = buildPuzzles(CANDIDATES, wordsByInitial);
  assertPuzzlesValid(puzzles, wordsByInitial);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  // Ship the full common dictionary so any valid expansion is accepted offline.
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", dictionary: [...dictionary].sort(), puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "acronym-attack.json"), json);
  // eslint-disable-next-line no-console
  console.log(`acronym-attack.json: ${puzzles.length} puzzles, ${dictionary.size}-word dict, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 5)) console.log(`  ${p.acronym} (${p.theme})`);
}

main();
