// Lowball-Countries content build tool.
// Reads the gitignored GloVe vector file, looks up frequency ranks for every
// country name in COUNTRY_LIST, groups by 3/4-letter prefix/suffix, applies
// the fairness gate, and writes public/lowball-countries.json.

import { writeFileSync, mkdirSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fnv1a32 } from "../src/kit/selection.ts";
import {
  COUNTRIES,
  groupCountriesByAffix,
  buildCountryPuzzles,
  assertCountryPuzzlesValid,
  countryGateFailureReason,
  COUNTRY_MIN_ANSWERS,
  COUNTRY_MAX_ANSWERS,
  type CountryCandidate,
  type CountryGateFailure,
  type ScoredCountry,
} from "../src/games/lowball/content-build.ts";

const PACK_VERSION = "1.0.0";
const MIN_PUZZLES = 1;
const MAX_PACK_BYTES = 100 * 1024;

async function loadGloveRanks(
  path: string,
  needed: Set<string>,
): Promise<Map<string, number>> {
  const ranks = new Map<string, number>();
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    const sp = line.indexOf(" ");
    const word = sp === -1 ? line : line.slice(0, sp);
    if (needed.has(word) && !ranks.has(word)) ranks.set(word, lineNo);
    if (ranks.size === needed.size) break;
  }
  return ranks;
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const glovePath = join(here, "..", "wordkit", "vectors", "glove.6B.50d.txt");

  if (!existsSync(glovePath)) {
    throw new Error(`GloVe vectors not found at ${glovePath}.`);
  }

  const needed = new Set(COUNTRIES.map((c) => c.name));
  process.stdout.write(`lowball-countries: ${COUNTRIES.length} country names to rank\n`);

  const ranks = await loadGloveRanks(glovePath, needed);
  process.stdout.write(
    `lowball-countries: resolved ${ranks.size}/${needed.size} GloVe ranks ` +
      `(${((100 * ranks.size) / Math.max(1, needed.size)).toFixed(1)}% in vocabulary)\n`,
  );

  const scored: ScoredCountry[] = COUNTRIES.map((c) => ({
    word: c.name,
    rank: ranks.get(c.name) ?? null,
    tier: c.tier,
  }));

  const groups = groupCountriesByAffix(scored);
  const viable = [...groups.entries()].filter(
    ([, list]) => list.length >= COUNTRY_MIN_ANSWERS && list.length <= COUNTRY_MAX_ANSWERS,
  );

  process.stdout.write(
    `lowball-countries: ${groups.size} affix groups, ${viable.length} in the ${COUNTRY_MIN_ANSWERS}..${COUNTRY_MAX_ANSWERS} band\n`,
  );

  const candidates: CountryCandidate[] = [];
  const rejections = new Map<CountryGateFailure, number>();
  for (const [key, list] of viable) {
    const colon = key.indexOf(":");
    const value = key.slice(colon + 1);
    const firstWord = list[0]?.word ?? "";
    const affixType = firstWord.endsWith(value) ? "suffix" : "prefix";
    const candidate: CountryCandidate = { affixType, affixValue: value, words: list };
    const failure = countryGateFailureReason(candidate);
    if (failure !== null) {
      rejections.set(failure, (rejections.get(failure) ?? 0) + 1);
      continue;
    }
    candidates.push(candidate);
  }

  process.stdout.write(`lowball-countries: ${candidates.length} categories passed the fairness gate\n`);
  for (const [reason, n] of [...rejections.entries()].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  rejected ${String(n).padStart(4)} -- ${reason}\n`);
  }

  const byHash = (a: CountryCandidate, b: CountryCandidate): number => {
    const ha = fnv1a32(`lowball-countries|${a.affixType}|${a.affixValue}`);
    const hb = fnv1a32(`lowball-countries|${b.affixType}|${b.affixValue}`);
    return ha - hb || `${a.affixType}:${a.affixValue}`.localeCompare(`${b.affixType}:${b.affixValue}`);
  };
  candidates.sort(byHash);

  const puzzles = buildCountryPuzzles(candidates);

  if (puzzles.length < MIN_PUZZLES) {
    throw new Error(`lowball-countries: only ${puzzles.length} categories passed, need at least ${MIN_PUZZLES}`);
  }
  assertCountryPuzzlesValid(puzzles);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: "country-list-1.0",
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC",
    fairnessGateVersion: "1.0.0",
    puzzles,
  };
  const json = JSON.stringify(pack);
  const bytes = Buffer.byteLength(json, "utf8");

  if (bytes > MAX_PACK_BYTES) {
    throw new Error(
      `lowball-countries: pack is ${(bytes / 1024).toFixed(1)} KiB, exceeding the ${MAX_PACK_BYTES / 1024} KiB ceiling`,
    );
  }

  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "lowball-countries.json"), json);
  process.stdout.write(`lowball-countries.json: ${puzzles.length} categories, ${(bytes / 1024).toFixed(1)} KiB\n`);

  for (const p of puzzles.slice(0, 5)) {
    const fz = p.answers.filter((a) => a.isFindable && a.panelScore === 0).length;
    process.stdout.write(
      `  ${p.categoryLabel} -- ${p.answers.length} answers, par ${p.parValue}, top ${p.answers[0]?.panelScore ?? 0}, ${fz} findable zero(s)\n`,
    );
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
