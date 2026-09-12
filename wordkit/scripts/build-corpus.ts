import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { DICTIONARY_ID, type CorpusData, type FrequencyTier, ALL_TIERS } from "../src/types.ts";

// Build-time corpus generator. Reads wordlist-english (SCOWL, en-GB) and emits
// data/en-GB/corpus.json — the dialect-neutral `english` words plus British-
// exclusive spellings, grouped by frequency tier. Each word appears in exactly
// one tier (its lowest / most-common occurrence). Committed to the repo.

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wordlist = require("wordlist-english") as Record<string, string[]>;

function tierWords(tier: FrequencyTier): string[] {
  const neutral = wordlist[`english/${tier}`] ?? [];
  const british = wordlist[`english/british/${tier}`] ?? [];
  return [...neutral, ...british];
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "data", "en-GB");
  mkdirSync(outDir, { recursive: true });

  // Assign each word to its lowest (most common) tier only, so tiers are disjoint.
  const seen = new Set<string>();
  const tiers: Record<string, string[]> = {};
  let total = 0;
  for (const tier of ALL_TIERS) {
    const words: string[] = [];
    for (const w of tierWords(tier)) {
      const lw = w.toLowerCase();
      if (seen.has(lw)) continue;
      seen.add(lw);
      words.push(lw);
    }
    words.sort();
    tiers[String(tier)] = words;
    total += words.length;
  }

  const data: CorpusData = {
    dictionaryId: DICTIONARY_ID,
    version: "1.0.0",
    dialect: "en-GB",
    tiers,
  };

  const json = JSON.stringify(data);
  writeFileSync(join(outDir, "corpus.json"), json);
  // eslint-disable-next-line no-console
  console.log(
    `corpus.json written: ${total} en-GB words across ${ALL_TIERS.length} tiers, ` +
      `${(json.length / 1024).toFixed(1)} KiB`,
  );
}

main();
