import { describe, it, expect } from "vitest";
import {
  balanceValue,
  classifyBalance,
  closenessBand,
  isFairTriple,
  buildPuzzle,
  assertPuzzleValid,
  encodeCell,
  decodeCell,
  packCodes,
  unpackCodes,
  type SimilarityFn,
} from "../src/games/parallax/content-build.ts";
import { CLOSENESS_MAX } from "../src/games/parallax/types.ts";

// Stub similarity: cosine defined via a 1-D "meaning axis" position per word.
// Distance grows with |pos difference|. Balanced target sits between two anchors.
const pos: Record<string, number> = { OCEAN: 0, DESERT: 10, COAST: 5, BEACH: 3, DUNE: 8, APPLE: 1 };
const sim: SimilarityFn = (a, b) => {
  const pa = pos[a.toUpperCase()] ?? 100;
  const pb = pos[b.toUpperCase()] ?? 100;
  // cosine-like: 1 when identical, decreasing with distance (bounded).
  return 1 - Math.min(2, Math.abs(pa - pb) / 10);
};
const has = (w: string) => w.toUpperCase() in pos;

describe("balance + closeness math", () => {
  it("balanceValue ~0.5 for a midpoint word", () => {
    const v = balanceValue(sim, "COAST", "OCEAN", "DESERT");
    expect(Math.abs(v - 0.5)).toBeLessThan(0.05);
  });
  it("balanceValue < 0.5 for a word nearer anchor A", () => {
    expect(balanceValue(sim, "BEACH", "OCEAN", "DESERT")).toBeLessThan(0.5);
  });
  it("classifyBalance windows around 0.5", () => {
    expect(classifyBalance(0.5)).toBe("BALANCED");
    expect(classifyBalance(0.2)).toBe("A");
    expect(classifyBalance(0.8)).toBe("B");
  });
  it("closenessBand is higher near the midpoint", () => {
    expect(closenessBand(0.5)).toBeGreaterThan(closenessBand(0.2));
  });
});

describe("fairness gate", () => {
  it("accepts a balanced triple with well-separated anchors", () => {
    expect(isFairTriple(sim, has, "OCEAN", "DESERT", "COAST", { minAnchorDistance: 0.5, maxTargetImbalance: 0.1 })).toBe(true);
  });
  it("rejects when target is not balanced", () => {
    expect(isFairTriple(sim, has, "OCEAN", "DESERT", "APPLE", { minAnchorDistance: 0.5, maxTargetImbalance: 0.1 })).toBe(false);
  });
  it("rejects identical members", () => {
    expect(isFairTriple(sim, has, "OCEAN", "OCEAN", "COAST")).toBe(false);
  });
});

describe("buildPuzzle", () => {
  it("pins the target to CLOSENESS_MAX and covers vocab", () => {
    const p = buildPuzzle(sim, has, "OCEAN", "DESERT", "COAST", ["COAST", "BEACH", "DUNE"], "puz-0000");
    expect(p.table.COAST.closeness).toBe(CLOSENESS_MAX);
    expect(p.table.BEACH).toBeDefined();
    expect(() => assertPuzzleValid(p)).not.toThrow();
  });
});

describe("pack encode/decode round-trip", () => {
  it("encodeCell/decodeCell are inverse", () => {
    for (const bal of ["A", "BALANCED", "B"] as const) {
      for (let c = 0; c <= CLOSENESS_MAX; c++) {
        const round = decodeCell(encodeCell(bal, c));
        expect(round).toEqual({ balance: bal, closeness: c });
      }
    }
  });
  it("packCodes/unpackCodes preserve the table over a shared vocab", () => {
    const p = buildPuzzle(sim, has, "OCEAN", "DESERT", "COAST", ["COAST", "BEACH", "DUNE"], "puz-0000");
    const vocab = ["COAST", "BEACH", "DUNE"];
    const codes = packCodes(p.table, vocab);
    const back = unpackCodes(codes, vocab);
    for (const w of vocab) expect(back[w]).toEqual(p.table[w]);
  });
});
