import { describe, it, expect } from "vitest";
import { deriveOrder, isFairRank, buildPuzzles, assertPuzzlesValid, type CandidateRank } from "../src/games/tier-list/content-build.ts";

const fair: CandidateRank = {
  words: ["absent", "fact", "huckster", "meerkats", "premised"],
  tiers: { fact: 10, absent: 20, premised: 35, huckster: 50, meerkats: 70 },
};

describe("deriveOrder", () => {
  it("orders commonest (lowest tier) first", () => {
    expect(deriveOrder(fair)).toEqual(["fact", "absent", "premised", "huckster", "meerkats"]);
  });
});

describe("isFairRank", () => {
  it("accepts distinct, well-separated tiers", () => {
    expect(isFairRank(fair)).toBe(true);
  });

  it("rejects a tie in tiers (ambiguous order)", () => {
    const tie: CandidateRank = { ...fair, tiers: { ...fair.tiers, absent: 10 } };
    expect(isFairRank(tie)).toBe(false);
  });

  it("rejects tiers that are too close together", () => {
    const close: CandidateRank = { ...fair, tiers: { fact: 10, absent: 12, premised: 14, huckster: 16, meerkats: 18 } };
    expect(isFairRank(close)).toBe(false);
  });

  it("rejects wrong count", () => {
    expect(isFairRank({ words: fair.words.slice(0, 4), tiers: fair.tiers })).toBe(false);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits fair puzzles and passes assert", () => {
    const puzzles = buildPuzzles([fair]);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].order[0]).toBe("fact");
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });

  it("drops unfair candidates (tied tiers)", () => {
    const tie: CandidateRank = { ...fair, tiers: { ...fair.tiers, absent: 10 } };
    expect(buildPuzzles([tie])).toHaveLength(0);
  });
});
