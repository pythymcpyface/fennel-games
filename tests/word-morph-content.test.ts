import { describe, it, expect } from "vitest";
import { buildLengthDataset, MIN_PAR, MAX_PAR } from "../src/games/word-morph/content-build.ts";
import { shortestPath, buildAdjacency } from "../src/games/word-morph/engine.ts";

// A small connected word family at length 4.
const words = ["cold", "cord", "card", "ward", "warm", "worm", "word", "wart", "cart", "care", "core", "bore"];

describe("word-morph content-build", () => {
  it("filters to the requested length, dedupes, sorts", () => {
    const ds = buildLengthDataset([...words, "toolong", "cold", "AB"], new Set(), 4);
    expect(ds.dictionaryWords).toEqual([...new Set(words)].sort());
    expect(ds.wordLength).toBe(4);
    expect(ds.dictionaryId).toBe("words-4-v1");
  });

  it("emits adjacency empty (rebuilt on load) but consistent components", () => {
    const ds = buildLengthDataset(words, new Set(), 4);
    expect(ds.adjacency).toEqual([]);
    expect(ds.componentIdByWordIndex.length).toBe(ds.dictionaryWords.length);
    expect(ds.componentCount).toBe(1 + Math.max(...ds.componentIdByWordIndex));
  });

  it("every candidate pair is solvable with par in range", () => {
    const ds = buildLengthDataset(words, new Set(), 4);
    const adjacency = buildAdjacency(ds.dictionaryWords);
    expect(ds.candidatePairs.length).toBeGreaterThan(0);
    for (const p of ds.candidatePairs) {
      const path = shortestPath(adjacency, p.startWordIndex, p.targetWordIndex);
      expect(path).not.toBeNull();
      expect((path as number[]).length - 1).toBe(p.par);
      expect(p.par).toBeGreaterThanOrEqual(MIN_PAR);
      expect(p.par).toBeLessThanOrEqual(MAX_PAR);
      expect(ds.componentIdByWordIndex[p.startWordIndex]).toBe(ds.componentIdByWordIndex[p.targetWordIndex]);
    }
  });

  it("honours the denylist", () => {
    const ds = buildLengthDataset(words, new Set(["warm"]), 4);
    expect(ds.dictionaryWords).not.toContain("warm");
  });

  it("throws when no solvable pairs exist", () => {
    // Isolated words with no one-letter neighbours => no pairs.
    expect(() => buildLengthDataset(["abcd", "wxyz"], new Set(), 4)).toThrow();
  });
});
