import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, filterByLength, wordTier } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidateRank } from "../src/games/tier-list/content-build.ts";
import { RANK_SIZE } from "../src/games/tier-list/types.ts";

// Tier List build tool. Ground-truth data only (wordkit SCOWL frequency tiers via
// wordTier). Assemble puzzles by drawing one word from each of RANK_SIZE well-
// separated tier bands so every familiarity step is a clear jump. The content-
// build gate enforces distinct, spread tiers so the correct order is unique.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const BANDS = [10, 20, 35, 50, 70]; // one word per band => RANK_SIZE distinct tiers
const MIN_TIER_GAP = 10;
const PUZZLES = 120;

function sampleSpread(pool: string[], n: number): string[] {
  if (pool.length <= n) return [...pool];
  return [...pool].sort((a, b) => fnv1a32(a) - fnv1a32(b)).slice(0, n);
}

function main(): void {
  if (BANDS.length !== RANK_SIZE) throw new Error("BANDS must have RANK_SIZE entries");

  // Build per-band candidate pools of moderately-lengthed words (4-8) to keep the
  // rarer tiers recognisably word-like rather than extreme obscurities.
  const words = filterByLength(filterAlphaOnly(loadCorpus({ maxTier: 70, lengths: [4, 8] })), 4, 8);
  const pools: Record<number, string[]> = {};
  for (const b of BANDS) pools[b] = [];
  for (const w of words) {
    const t = wordTier(w);
    if (t !== null && pools[t]) pools[t].push(w);
  }
  // deterministic spread within each band
  for (const b of BANDS) pools[b] = sampleSpread(pools[b], 400);

  const candidates: CandidateRank[] = [];
  for (let i = 0; i < PUZZLES; i++) {
    const picked: string[] = [];
    const tiers: Record<string, number> = {};
    let ok = true;
    for (let bi = 0; bi < BANDS.length; bi++) {
      const b = BANDS[bi];
      const pool = pools[b];
      if (pool.length === 0) { ok = false; break; }
      const w = pool[(i * 7 + bi * 101) % pool.length];
      if (picked.includes(w)) { ok = false; break; }
      picked.push(w);
      tiers[w] = b;
    }
    if (!ok || new Set(picked).size !== RANK_SIZE) continue;
    candidates.push({ words: picked, tiers });
  }

  const puzzles = buildPuzzles(candidates, MIN_TIER_GAP);
  assertPuzzlesValid(puzzles, MIN_TIER_GAP);
  if (puzzles.length === 0) throw new Error("tier-list: no fair puzzles produced");

  const here = dirname(fileURLToPath(import.meta.url));
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
  writeFileSync(join(outDir, "tier-list.json"), json);
  // eslint-disable-next-line no-console
  console.log(`tier-list.json: ${puzzles.length}/${candidates.length} puzzles, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 8)) console.log(`  ${p.order.map((w) => `${w}[${p.tiers[w]}]`).join(" > ")}`);
}

main();
