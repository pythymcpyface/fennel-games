import { describe, it, expect } from "vitest";
import { loadCorpus, loadCorpusData } from "../src/corpus/load.ts";
import { collectTiers, filterAlphaOnly, filterByLength } from "../src/corpus/filter.ts";
import type { CorpusData } from "../src/types.ts";

describe("corpus filters (pure)", () => {
  const data: CorpusData = {
    dictionaryId: "test",
    version: "0",
    dialect: "en-GB",
    tiers: {
      "10": ["cat", "dog", "run"],
      "20": ["longer", "abc"],
      "70": ["archaic", "x1"],
    },
  };

  it("collectTiers includes only tiers <= maxTier, deduped + sorted", () => {
    expect(collectTiers(data, 10)).toEqual(["cat", "dog", "run"]);
    expect(collectTiers(data, 20)).toEqual(["abc", "cat", "dog", "longer", "run"]);
  });

  it("filterAlphaOnly drops non a-z entries", () => {
    expect(filterAlphaOnly(["cat", "x1", "a-b"])).toEqual(["cat"]);
  });

  it("filterByLength is inclusive on both ends", () => {
    expect(filterByLength(["ab", "abc", "abcd"], 3, 3)).toEqual(["abc"]);
  });
});

describe("loadCorpus (real committed en-GB data)", () => {
  it("loads the committed corpus with the wordkit dictionaryId", () => {
    const data = loadCorpusData();
    expect(data.dialect).toBe("en-GB");
    expect(data.dictionaryId).toBe("wordkit.en-GB.v1");
  });

  it("accepts real words that the old 140-word list rejected (mounting)", () => {
    const words = new Set(loadCorpus({ maxTier: 70 }));
    expect(words.has("mounting")).toBe(true);
    expect(words.has("mount")).toBe(true);
    expect(words.has("mountain")).toBe(true);
  });

  it("includes British spellings", () => {
    const words = new Set(loadCorpus({ maxTier: 70 }));
    for (const w of ["colour", "behaviour", "defence", "centre"]) {
      expect(words.has(w)).toBe(true);
    }
  });

  it("maxTier monotonically grows the list", () => {
    expect(loadCorpus({ maxTier: 20 }).length).toBeLessThan(loadCorpus({ maxTier: 70 }).length);
  });

  it("default options are alpha-only and length-unbounded", () => {
    const words = loadCorpus({ maxTier: 35 });
    expect(words.every((w) => /^[a-z]+$/.test(w))).toBe(true);
  });

  it("length filter bounds word lengths", () => {
    const words = loadCorpus({ maxTier: 35, lengths: [4, 6] });
    expect(words.every((w) => w.length >= 4 && w.length <= 6)).toBe(true);
  });
});
