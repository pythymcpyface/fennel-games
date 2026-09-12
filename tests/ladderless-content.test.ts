import { describe, it, expect } from "vitest";
import {
  buildRankTable,
  assertRankTableValid,
  computePar,
  buildPuzzle,
  type SimilarityFn,
} from "../src/games/ladderless/content-build.ts";
import { derivePuzzleId, canonicalizeDayId } from "../src/kit/selection.ts";
import { evaluateGuess } from "../src/games/ladderless/engine.ts";

// Phase 2 — content build pipeline + golden-vector determinism (JOURNEY-007,
// FIX-GOLDEN-VECTORS, RISK-001/005, NFR-002).

const vocab = ["ocean", "sea", "wave", "river", "cloud", "rock", "stone", "sand"];

// Deterministic stub similarity: closeness by shared prefix length + inverse
// alphabetical distance. Pure and stable, standing in for embedding cosine.
const stubSim: SimilarityFn = (a, b) => {
  let shared = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) shared++;
    else break;
  }
  return shared * 100 - Math.abs(a.charCodeAt(0) - b.charCodeAt(0));
};

describe("buildRankTable + coverage gate (RISK-005)", () => {
  it("assigns rank 1 to the target and full 1..N coverage", () => {
    const table = buildRankTable("ocean", vocab, stubSim);
    expect(table.ranks["ocean"]).toBe(1);
    expect(table.vocabSize).toBe(vocab.length);
    expect(() => assertRankTableValid(table, vocab)).not.toThrow();
  });

  it("produces a deterministic ranking (stable across builds)", () => {
    const a = buildRankTable("ocean", vocab, stubSim);
    const b = buildRankTable("ocean", vocab, stubSim);
    expect(a.ranks).toEqual(b.ranks);
  });

  it("breaks ties lexicographically (determinism)", () => {
    const flat: SimilarityFn = () => 0; // all equal => pure lexicographic order
    const table = buildRankTable("ocean", vocab, flat);
    // non-target words ranked 2.. in sorted order: cloud, river, rock, sand, sea, stone, wave
    expect(table.ranks["cloud"]).toBe(2);
    expect(table.ranks["wave"]).toBe(vocab.length); // last alphabetically
  });

  it("coverage gate throws when a word is missing", () => {
    const table = buildRankTable("ocean", vocab, stubSim);
    delete table.ranks["sand"];
    expect(() => assertRankTableValid(table, vocab)).toThrow();
  });
});

describe("computePar / buildPuzzle", () => {
  it("computes par >= 3", () => {
    const table = buildRankTable("ocean", vocab, stubSim);
    expect(computePar("rock", table)).toBeGreaterThanOrEqual(3);
  });
  it("assembles a puzzle with a valid par", () => {
    const table = buildRankTable("ocean", vocab, stubSim);
    const p = buildPuzzle("puz-0001", "rock", "ocean", table);
    expect(p.targetWord).toBe("ocean");
    expect(p.parGuesses).toBeGreaterThanOrEqual(3);
  });
});

describe("GOLDEN VECTORS — cross-platform determinism (NFR-002)", () => {
  // These exact values must never change without a contentPackVersion bump.
  it("dayId + puzzleId golden values are stable", () => {
    expect(canonicalizeDayId(1711929600000, "UTC")).toBe("2024-04-01");
    expect(derivePuzzleId("2024-04-01", "1.0.0", "core.en.v1", 365)).toBe("puz-0207");
    expect(derivePuzzleId("2024-04-02", "1.0.0", "core.en.v1", 365)).toBe("puz-0315");
  });

  it("guess evaluation golden values are stable", () => {
    const table = buildRankTable("ocean", vocab, stubSim);
    // stub: "sea"/"sand"/"stone" share prefix 's' with... target "ocean" shares none.
    const ev = evaluateGuess("sea", table, table.vocabSize);
    expect(ev.semanticRank).toBe(table.ranks["sea"]);
    expect(ev.isWin).toBe(false);
    expect(evaluateGuess("ocean", table, 5).isWin).toBe(true);
  });
});
