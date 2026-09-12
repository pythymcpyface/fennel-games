import { describe, it, expect } from "vitest";
import {
  normalizeGuess,
  rankToTier,
  evaluateGuess,
  reduceGameState,
  initGameState,
} from "../src/games/ladderless/engine.ts";
import type { RankTable, GameState } from "../src/games/ladderless/types.ts";

// Phase 3 — guess evaluation + state. Sources: guess_evaluation.feature
// (@REQ-006..012, AC-TEST-011..022). Uses a small deterministic rank table (FIX-DICT-SMALL).

const table: RankTable = {
  targetWord: "ocean",
  vocabSize: 6,
  // 1 = target; lower rank = closer.
  ranks: { ocean: 1, sea: 2, wave: 3, river: 4, cloud: 5, rock: 6 },
  tierCutoffs: [2, 4], // tier0: rank<2 ; tier1: rank<4 ; tier2: else
};

describe("normalizeGuess", () => {
  it("trims, lowercases and NFC-normalizes", () => {
    expect(normalizeGuess("  Ocean ")).toBe("ocean");
    expect(normalizeGuess("SEA")).toBe("sea");
  });
  it("rejects empty / whitespace-only", () => {
    expect(() => normalizeGuess("   ")).toThrow();
    expect(() => normalizeGuess("")).toThrow();
  });
  it("rejects non a-z characters and over-length input", () => {
    expect(() => normalizeGuess("oce4n")).toThrow();
    expect(() => normalizeGuess("a".repeat(65))).toThrow();
  });
});

describe("rankToTier (FIELD-011)", () => {
  it("buckets rank by ascending cutoffs", () => {
    expect(rankToTier(1, table.tierCutoffs)).toBe(0);
    expect(rankToTier(2, table.tierCutoffs)).toBe(1);
    expect(rankToTier(3, table.tierCutoffs)).toBe(1);
    expect(rankToTier(4, table.tierCutoffs)).toBe(2);
    expect(rankToTier(6, table.tierCutoffs)).toBe(2);
  });
});

describe("evaluateGuess (REQ-008/009/011)", () => {
  it("AC-TEST-014: returns deterministic rank + tier for a covered word", () => {
    const r = evaluateGuess("wave", table, table.vocabSize);
    expect(r.semanticRank).toBe(3);
    expect(r.rankTier).toBe(1);
  });

  it("AC-TEST-016: rank better than bestRank => warmer and updates best", () => {
    const r = evaluateGuess("sea", table, /*priorBest*/ 4);
    expect(r.verdict).toBe("warmer");
  });

  it("AC-TEST-017: rank worse than bestRank => colder", () => {
    const r = evaluateGuess("cloud", table, /*priorBest*/ 2);
    expect(r.verdict).toBe("colder");
  });

  it("equal rank to best => colder (no improvement)", () => {
    const r = evaluateGuess("wave", table, /*priorBest*/ 3);
    expect(r.verdict).toBe("colder");
  });

  it("AC-TEST-020: exact target => isWin true and verdict best", () => {
    const r = evaluateGuess("ocean", table, /*priorBest*/ 3);
    expect(r.isWin).toBe(true);
    expect(r.verdict).toBe("best");
    expect(r.semanticRank).toBe(1);
  });

  it("O-1: word outside the rank universe scores worst rank + colder (no throw)", () => {
    const r = evaluateGuess("banana", table, table.vocabSize);
    expect(r.semanticRank).toBe(table.vocabSize + 1);
    expect(r.isWin).toBe(false);
    expect(r.verdict).toBe("colder");
  });
});

describe("reduceGameState (REQ-010/012/018)", () => {
  const base: GameState = initGameState("puz-0001", "2024-04-01", table.vocabSize);

  it("appends guess with incrementing index and sets in_progress on first guess", () => {
    const ev = evaluateGuess("river", table, base.bestRank);
    const s1 = reduceGameState(base, ev, "river", 1000);
    expect(s1.guessHistory).toHaveLength(1);
    expect(s1.guessHistory[0].guessIndex).toBe(1);
    expect(s1.status).toBe("in_progress");
    expect(s1.bestRank).toBe(4);

    const ev2 = evaluateGuess("sea", table, s1.bestRank);
    const s2 = reduceGameState(s1, ev2, "sea", 1001);
    expect(s2.guessHistory[1].guessIndex).toBe(2);
    expect(s2.bestRank).toBe(2); // improved
  });

  it("bestRank does not regress on a colder guess", () => {
    const ev = evaluateGuess("sea", table, base.bestRank);
    const s1 = reduceGameState(base, ev, "sea", 1000); // best=2
    const ev2 = evaluateGuess("rock", table, s1.bestRank);
    const s2 = reduceGameState(s1, ev2, "rock", 1001); // rank6, colder
    expect(s2.bestRank).toBe(2);
  });

  it("AC-TEST-022: winning guess transitions status to won", () => {
    const ev = evaluateGuess("ocean", table, base.bestRank);
    const s1 = reduceGameState(base, ev, "ocean", 1000);
    expect(s1.status).toBe("won");
  });

  it("is a pure reducer (does not mutate prev state)", () => {
    const ev = evaluateGuess("river", table, base.bestRank);
    reduceGameState(base, ev, "river", 1000);
    expect(base.guessHistory).toHaveLength(0);
    expect(base.status).toBe("not_started");
  });
});
