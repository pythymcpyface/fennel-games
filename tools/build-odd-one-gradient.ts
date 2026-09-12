import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, loadGloveVectors, buildRankTable } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/odd-one-gradient/content-build.ts";
import { SET_SIZE } from "../src/games/odd-one-gradient/types.ts";

// Odd-One Gradient build tool. For each curated set (5 cohesive words + 1 intended
// outlier), compute each word's COLDNESS = median rank of the other set members
// when a large GloVe universe is centred on that word. The content-build derives
// the outlier and enforces a decisive coldness margin; ambiguous sets are dropped.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const UNIVERSE_CAP = 1500;

// Curated sets: the last word is the intended outlier (derivation still validates).
const SETS: Array<{ words: string[]; theme: string }> = [
  { words: ["apple", "banana", "orange", "grape", "peach", "hammer"], theme: "fruit" },
  { words: ["red", "blue", "green", "yellow", "purple", "river"], theme: "colours" },
  { words: ["dog", "cat", "horse", "cow", "sheep", "table"], theme: "farm animals" },
  { words: ["piano", "guitar", "violin", "drum", "flute", "doctor"], theme: "instruments" },
  { words: ["monday", "tuesday", "friday", "sunday", "saturday", "kitchen"], theme: "days of the week" },
  { words: ["copper", "iron", "silver", "gold", "bronze", "pencil"], theme: "metals" },
  { words: ["january", "march", "june", "october", "december", "planet"], theme: "months" },
  { words: ["shirt", "trousers", "jacket", "sweater", "scarf", "engine"], theme: "clothing" },
  { words: ["breakfast", "lunch", "dinner", "supper", "snack", "mountain"], theme: "meals" },
  { words: ["hammer", "wrench", "screwdriver", "drill", "saw", "banana"], theme: "tools" },
  { words: ["france", "spain", "italy", "germany", "poland", "guitar"], theme: "countries" },
  { words: ["lion", "tiger", "leopard", "cheetah", "jaguar", "letter"], theme: "big cats" },
  { words: ["rose", "tulip", "daisy", "lily", "orchid", "hammer"], theme: "flowers" },
  { words: ["circle", "square", "triangle", "rectangle", "hexagon", "coffee"], theme: "shapes" },
  { words: ["doctor", "nurse", "teacher", "lawyer", "engineer", "pepper"], theme: "professions" },
  { words: ["summer", "winter", "spring", "autumn", "season", "camera"], theme: "seasons" },
  { words: ["coffee", "tea", "juice", "water", "milk", "hammer"], theme: "drinks" },
  { words: ["train", "bus", "taxi", "tram", "ferry", "pencil"], theme: "transport" },
  { words: ["hand", "foot", "finger", "elbow", "knee", "table"], theme: "body parts" },
  { words: ["rain", "snow", "wind", "storm", "thunder", "guitar"], theme: "weather" },
];

function sampleSpread(pool: string[], n: number): string[] {
  if (pool.length <= n) return [...pool];
  return [...pool].sort((a, b) => fnv1a32(a) - fnv1a32(b)).slice(0, n).sort();
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const glovePath = join(here, "..", "wordkit", "vectors", "glove.6B.50d.txt");
  if (!existsSync(glovePath)) throw new Error(`GloVe vectors not found at ${glovePath}. Run npm run fetch-glove in wordkit/.`);
  const provider = loadGloveVectors(glovePath);

  const universe = sampleSpread(
    loadCorpus({ maxTier: 35, lengths: [3, 10] }).filter((w) => provider.has(w)),
    UNIVERSE_CAP,
  );

  const candidates: CandidateSet[] = [];
  for (const { words, theme } of SETS) {
    if (words.length !== SET_SIZE) continue;
    const inV = words.filter((w) => provider.has(w));
    if (inV.length !== SET_SIZE) {
      // eslint-disable-next-line no-console
      console.log(`  skip ${theme}: OOV member(s)`);
      continue;
    }
    const uni = [...new Set([...words, ...universe])];
    const coldness: Record<string, number> = {};
    for (const w of words) {
      const table = buildRankTable(w, uni, provider);
      const others = words.filter((o) => o !== w);
      coldness[w] = median(others.map((o) => table.ranks[o] ?? uni.length));
    }
    candidates.push({ words, coldness, themeLabel: theme });
  }

  const puzzles = buildPuzzles(candidates);
  assertPuzzlesValid(puzzles);
  if (puzzles.length === 0) throw new Error("odd-one-gradient: no fair sets produced");

  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC",
    puzzles,
  };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "odd-one-gradient.json"), json);
  // eslint-disable-next-line no-console
  console.log(`odd-one-gradient.json: ${puzzles.length}/${SETS.length} sets passed, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles) console.log(`  [${p.themeLabel}] odd=${p.odd}`);
}

main();
