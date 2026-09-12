import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, loadGloveVectors, buildRankTable } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidateTrail, type CandidateWord } from "../src/games/twin-trails/content-build.ts";
import { PER_SIDE } from "../src/games/twin-trails/types.ts";

// Twin Trails build tool. For each curated pivot pair (A,B), rank a large GloVe
// universe against both, then pick the PER_SIDE words most decisively closer to A
// and the PER_SIDE most decisively closer to B (by signed rank margin). The
// content-build fairness gate enforces a clear per-word margin so no board word is
// a coin-flip. GloVe is build-time only; the pack ships gold labels + words.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const UNIVERSE_CAP = 1800;
const MIN_MARGIN = 60; // signed rank margin required for a word to be decisively on-side
const A_MAX_RANK = 80; // A-words must also be absolutely close to A
const B_MAX_RANK = 80;

// Generic/noisy tokens that read as decisive by GloVe but confuse players. Kept
// small; the margin gate already guarantees fairness — this is a quality filter.
const NOISE = new Set<string>([
  "hours", "fact", "your", "wins", "boast", "latter", "uncommon", "reportedly",
  "skipped", "commenced", "completion", "studying", "pursue", "convenient",
  "hoping", "sought", "press", "sells", "articles", "instructed", "challenge",
  "peers", "bucked", "vogue", "east", "wild", "smooth", "globe", "your",
  "dedication", "foundation", "operate", "occupying", "stationed",
]);

const PAIRS: Array<{ a: string; b: string; labelA: string; labelB: string }> = [
  { a: "ocean", b: "forest", labelA: "the sea", labelB: "the woods" },
  { a: "music", b: "sport", labelA: "music", labelB: "sport" },
  { a: "kitchen", b: "garden", labelA: "the kitchen", labelB: "the garden" },
  { a: "doctor", b: "farmer", labelA: "medicine", labelB: "farming" },
  { a: "winter", b: "summer", labelA: "winter", labelB: "summer" },
  { a: "city", b: "village", labelA: "the city", labelB: "the village" },
  { a: "war", b: "music", labelA: "war", labelB: "music" },
  { a: "space", b: "ocean", labelA: "space", labelB: "the ocean" },
  { a: "school", b: "hospital", labelA: "school", labelB: "hospital" },
  { a: "kitchen", b: "workshop", labelA: "cooking", labelB: "the workshop" },
  { a: "desert", b: "jungle", labelA: "the desert", labelB: "the jungle" },
  { a: "banking", b: "farming", labelA: "finance", labelB: "farming" },
  { a: "painting", b: "engineering", labelA: "art", labelB: "engineering" },
  { a: "sailing", b: "flying", labelA: "sailing", labelB: "flying" },
  { a: "cooking", b: "gardening", labelA: "cooking", labelB: "gardening" },
];

function sampleSpread(pool: string[], n: number): string[] {
  if (pool.length <= n) return [...pool];
  return [...pool].sort((a, b) => fnv1a32(a) - fnv1a32(b)).slice(0, n).sort();
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const glovePath = join(here, "..", "wordkit", "vectors", "glove.6B.50d.txt");
  if (!existsSync(glovePath)) throw new Error(`GloVe vectors not found at ${glovePath}. Run npm run fetch-glove in wordkit/.`);
  const provider = loadGloveVectors(glovePath);

  const universe = sampleSpread(
    loadCorpus({ maxTier: 40, lengths: [4, 10] }).filter((w) => provider.has(w)),
    UNIVERSE_CAP,
  );

  const candidates: CandidateTrail[] = [];
  for (const { a, b, labelA, labelB } of PAIRS) {
    if (!provider.has(a) || !provider.has(b)) {
      // eslint-disable-next-line no-console
      console.log(`  skip ${a}/${b}: OOV`);
      continue;
    }
    const uni = [...new Set([a, b, ...universe])];
    const tA = buildRankTable(a, uni, provider);
    const tB = buildRankTable(b, uni, provider);
    const scored = universe
      .filter((w) => w !== a && w !== b && !NOISE.has(w))
      .map((w) => ({ w, rA: tA.ranks[w], rB: tB.ranks[w] }));

    // A-side: decisively closer to A (positive margin) AND absolutely near A.
    const aSide = scored
      .filter((s) => s.rA <= A_MAX_RANK && s.rB - s.rA >= MIN_MARGIN)
      .sort((x, y) => (y.rB - y.rA) - (x.rB - x.rA))
      .slice(0, PER_SIDE * 3);
    const bSide = scored
      .filter((s) => s.rB <= B_MAX_RANK && s.rA - s.rB >= MIN_MARGIN)
      .sort((x, y) => (y.rA - y.rB) - (x.rA - x.rB))
      .slice(0, PER_SIDE * 3);
    if (aSide.length < PER_SIDE || bSide.length < PER_SIDE) {
      // eslint-disable-next-line no-console
      console.log(`  skip ${a}/${b}: insufficient decisive words (A=${aSide.length} B=${bSide.length})`);
      continue;
    }

    // Spread deterministically within each side for variety, then take PER_SIDE.
    const pick = (arr: typeof aSide) =>
      [...arr].sort((x, y) => fnv1a32(x.w) - fnv1a32(y.w)).slice(0, PER_SIDE);
    const words: CandidateWord[] = [
      ...pick(aSide).map((s) => ({ word: s.w, rankA: s.rA, rankB: s.rB, side: "A" as const })),
      ...pick(bSide).map((s) => ({ word: s.w, rankA: s.rA, rankB: s.rB, side: "B" as const })),
    ];
    candidates.push({ labelA, labelB, words });
  }

  const puzzles = buildPuzzles(candidates, MIN_MARGIN);
  assertPuzzlesValid(puzzles);
  if (puzzles.length === 0) throw new Error("twin-trails: no fair puzzles produced");

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
  writeFileSync(join(outDir, "twin-trails.json"), json);
  // eslint-disable-next-line no-console
  console.log(`twin-trails.json: ${puzzles.length}/${PAIRS.length} pairs passed, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles) {
    const a = p.words.filter((w) => p.gold[w] === "A");
    const b = p.words.filter((w) => p.gold[w] === "B");
    console.log(`  [${p.labelA} | ${p.labelB}] A:{${a.join(" ")}} B:{${b.join(" ")}}`);
  }
}

main();
