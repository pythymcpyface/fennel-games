import { describe, it, expect } from "vitest";
import { buildRankTable, assertRankTableValid } from "../src/similarity/rank.ts";
import { buildEditDistanceGraph } from "../src/graph/edit-distance.ts";
import type { SimilarityProvider } from "../src/types.ts";

// Stub provider: similarity is a fixed lookup so tests are deterministic and
// need no GloVe download. Missing words => -Infinity (OOV contract).
function stubProvider(sims: Record<string, number>): SimilarityProvider {
  return {
    has: (w) => w in sims,
    cosine: (a, b) => {
      const key = `${a}|${b}`;
      const rev = `${b}|${a}`;
      if (key in sims) return sims[key];
      if (rev in sims) return sims[rev];
      return -Infinity;
    },
  };
}

describe("buildRankTable", () => {
  const universe = ["stone", "rock", "cliff", "river"];
  const provider = stubProvider({
    "stone|rock": 0.9,
    "stone|cliff": 0.5,
    "stone|river": 0.1,
  });

  it("ranks target 1, then by descending similarity", () => {
    const t = buildRankTable("stone", universe, provider);
    expect(t.ranks["stone"]).toBe(1);
    expect(t.ranks["rock"]).toBe(2);
    expect(t.ranks["cliff"]).toBe(3);
    expect(t.ranks["river"]).toBe(4);
  });

  it("covers exactly the universe (+target) with unique ranks", () => {
    const t = buildRankTable("stone", universe, provider);
    expect(() => assertRankTableValid(t, universe.filter((w) => w !== "stone"))).not.toThrow();
  });

  it("is deterministic with lexicographic tie-break at equal similarity", () => {
    const p = stubProvider({ "t|b": 0.5, "t|a": 0.5, "t|c": 0.5 });
    const t = buildRankTable("t", ["b", "a", "c"], p);
    // equal sims => alphabetical: a(2) b(3) c(4)
    expect([t.ranks["a"], t.ranks["b"], t.ranks["c"]]).toEqual([2, 3, 4]);
  });

  it("sorts OOV (-Infinity) words to the end, deterministically by word", () => {
    const p = stubProvider({ "t|known": 0.9 });
    const t = buildRankTable("t", ["zebra", "known", "apple"], p);
    expect(t.ranks["known"]).toBe(2); // only scored word ranks best
    expect(t.ranks["apple"]).toBe(3); // OOV, alphabetical
    expect(t.ranks["zebra"]).toBe(4);
  });
});

describe("buildEditDistanceGraph", () => {
  it("links words differing by exactly one letter (same length)", () => {
    const g = buildEditDistanceGraph(["cat", "cot", "cog", "dog"]);
    expect(g.get("cat")).toEqual(["cot"]);
    expect(g.get("cot")).toEqual(["cat", "cog"]);
    expect(g.get("cog")).toEqual(["cot", "dog"]);
    expect(g.get("dog")).toEqual(["cog"]);
  });

  it("does not link words of different lengths", () => {
    const g = buildEditDistanceGraph(["cat", "cats"]);
    expect(g.get("cat")).toEqual([]);
    expect(g.get("cats")).toEqual([]);
  });

  it("neighbour lists are sorted (deterministic)", () => {
    const g = buildEditDistanceGraph(["bat", "cat", "hat", "eat"]);
    expect(g.get("eat")).toEqual(["bat", "cat", "hat"]);
  });
});
