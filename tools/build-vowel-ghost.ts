import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpusData, filterAlphaOnly } from "../wordkit/src/index.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/vowel-ghost/content-build.ts";
import { stripVowels } from "../src/games/vowel-ghost/engine.ts";

// Build-time generator wired to @cic/wordkit. Builds a frequency-ranked map of
// skeleton -> words (most common first) from the corpus tiers. A themed answer ships
// only if it is the MOST COMMON word filling its consonant skeleton, so a fair player
// reaches for the obvious word. wordkit never ships (only the derived pack does).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "en_vowelghost_v1";

const SETS: CandidateSet[] = [
  // Members chosen to be the most-common filling of their skeleton (verified vs corpus).
  { words: ["LEMON", "PEACH", "MELON", "OLIVE", "MANGO"], themeLabel: "Fruit" },
  { words: ["TIGER", "ZEBRA", "HORSE", "MOOSE", "OTTER"], themeLabel: "Animals" },
  { words: ["RIVER", "FOREST", "DESERT", "VALLEY", "CANYON"], themeLabel: "Landscapes" },
  { words: ["COPPER", "SILVER", "IRON", "NICKEL", "COBALT"], themeLabel: "Metals" },
  { words: ["PLANET", "COMET", "GALAXY", "METEOR", "ROCKET"], themeLabel: "Space" },
  { words: ["WATER", "CIDER", "COCOA", "NECTAR", "LAGER"], themeLabel: "Drinks" },
  { words: ["LONDON", "MADRID", "BERLIN", "LISBON", "VIENNA"], themeLabel: "Capitals" },
  { words: ["SUMMER", "WINTER", "AUTUMN", "SEASON", "SOLSTICE"], themeLabel: "Seasons" },
  { words: ["PENCIL", "RULER", "ERASER", "MARKER", "FOLDER"], themeLabel: "Stationery" },
  { words: ["COTTON", "DENIM", "LEATHER", "VELVET", "LINEN"], themeLabel: "Fabrics" },
];

function main(): void {
  const data = loadCorpusData();
  // Rank by tier ascending (lower tier number = more common). Restrict the fairness
  // universe to reasonably common words so obscure collisions don't disqualify a
  // sensible answer.
  const MAX_UNIVERSE_TIER = 55;
  const wordTier = new Map<string, number>();
  for (const [tierStr, words] of Object.entries(data.tiers)) {
    const tier = Number(tierStr);
    if (tier > MAX_UNIVERSE_TIER) continue;
    for (const w of filterAlphaOnly(words as string[])) {
      const up = w.toUpperCase();
      if (!wordTier.has(up) || tier < wordTier.get(up)!) wordTier.set(up, tier);
    }
  }
  const dictionary = new Set(wordTier.keys());
  for (const s of SETS) for (const w of s.words) { const u = w.toUpperCase(); dictionary.add(u); if (!wordTier.has(u)) wordTier.set(u, 45); }

  const rankBySkeleton: Record<string, string[]> = {};
  for (const w of dictionary) (rankBySkeleton[stripVowels(w)] ??= []).push(w);
  for (const k of Object.keys(rankBySkeleton)) {
    rankBySkeleton[k].sort((a, b) => (wordTier.get(a)! - wordTier.get(b)!) || (a < b ? -1 : 1));
  }

  const puzzles = buildPuzzles(SETS, dictionary, rankBySkeleton);
  assertPuzzlesValid(puzzles, dictionary, rankBySkeleton);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const runtimeDict = [...new Set(puzzles.flatMap((p) => p.words))].sort();
  const pack = { contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length, dayBoundaryRule: "UTC", dictionary: runtimeDict, puzzles };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "vowel-ghost.json"), json);
  // eslint-disable-next-line no-console
  console.log(`vowel-ghost.json: ${puzzles.length}/${SETS.length} sets passed, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 6)) console.log(`  [${p.themeLabel}] ${p.skeletons.join(" ")}`);
  const dropped = SETS.length - puzzles.length;
  if (dropped > 0) console.log(`  NOTE: ${dropped} set(s) dropped (a member was not the most-common vowel filling).`);
}

main();
