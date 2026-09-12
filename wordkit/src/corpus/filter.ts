import type { CorpusData } from "../types.ts";

/** Pure filter helpers over a flat word list. All deterministic. */

export function filterAlphaOnly(words: readonly string[]): string[] {
  return words.filter((w) => /^[a-z]+$/.test(w));
}

export function filterByLength(words: readonly string[], min: number, max: number): string[] {
  return words.filter((w) => w.length >= min && w.length <= max);
}

/** Flatten corpus tiers up to and including maxTier, deduped, sorted. */
export function collectTiers(data: CorpusData, maxTier: number): string[] {
  const out = new Set<string>();
  for (const [tierKey, words] of Object.entries(data.tiers)) {
    if (Number(tierKey) <= maxTier) {
      for (const w of words) out.add(w);
    }
  }
  return [...out].sort();
}
