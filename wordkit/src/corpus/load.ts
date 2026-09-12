import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { CorpusData, CorpusOptions } from "../types.ts";
import { collectTiers, filterAlphaOnly, filterByLength } from "./filter.ts";

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = join(here, "..", "..", "data", "en-GB", "corpus.json");

let cached: CorpusData | null = null;

/** Load the committed en-GB corpus data (cached across calls). */
export function loadCorpusData(): CorpusData {
  if (cached === null) {
    cached = JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as CorpusData;
  }
  return cached;
}

/**
 * Load a filtered en-GB word list. Deterministic (sorted). Build-time helper —
 * reads from the filesystem, not intended to run in the browser.
 */
export function loadCorpus(opts: CorpusOptions = {}): string[] {
  const { maxTier = 35, lengths, alphaOnly = true } = opts;
  const data = loadCorpusData();

  let words = collectTiers(data, maxTier);
  if (alphaOnly) words = filterAlphaOnly(words);
  if (lengths) words = filterByLength(words, lengths[0], lengths[1]);
  return words;
}

let tierIndex: Map<string, number> | null = null;

/**
 * Frequency tier of a word (10 = commonest … 70 = rarest), or null if absent.
 * Build-time helper; used to derive frequency-weighted models (e.g. sever's
 * unigram scores).
 */
export function wordTier(word: string): number | null {
  if (tierIndex === null) {
    tierIndex = new Map();
    const data = loadCorpusData();
    for (const [tierKey, words] of Object.entries(data.tiers)) {
      const tier = Number(tierKey);
      for (const w of words) if (!tierIndex.has(w)) tierIndex.set(w, tier);
    }
  }
  return tierIndex.get(word) ?? null;
}
