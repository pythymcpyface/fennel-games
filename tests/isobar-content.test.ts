import { describe, it, expect } from "vitest";
import {
  dist,
  ringForDistance,
  computeRings,
  buildPuzzle,
  assertPuzzleValid,
  type SimilarityFn,
} from "../src/games/isobar/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/isobar/share.ts";
import type { AttemptState } from "../src/games/isobar/types.ts";

// Stub similarity via a 1-D meaning axis. Distance grows with |pos difference|.
const pos: Record<string, number> = { CENTER: 0, A: 1, B: 3, C: 5, D: 7, E: 9, X: 3 };
const sim: SimilarityFn = (a, b) => 1 - Math.min(2, Math.abs((pos[a.toUpperCase()] ?? 50) - (pos[b.toUpperCase()] ?? 50)) / 10);
const CUTOFFS = [0.15, 0.35, 0.55, 0.75];

describe("distance + banding", () => {
  it("dist decreases with similarity", () => {
    expect(dist(sim, "CENTER", "CENTER")).toBeCloseTo(0);
    expect(dist(sim, "CENTER", "A")).toBeLessThan(dist(sim, "CENTER", "E"));
  });
  it("ringForDistance buckets ascending", () => {
    expect(ringForDistance(0.1, CUTOFFS)).toBe(0);
    expect(ringForDistance(0.5, CUTOFFS)).toBe(2);
    expect(ringForDistance(0.9, CUTOFFS)).toBe(4);
  });
});

describe("computeRings fairness", () => {
  it("returns distinct rings for well-separated words", () => {
    const rings = computeRings(sim, "CENTER", ["A", "B", "C", "D", "E"], CUTOFFS);
    expect(rings).not.toBeNull();
    expect(new Set(rings!).size).toBe(5);
  });
  it("rejects when two words collide on a ring", () => {
    // B and X both at pos 3 -> same distance -> same ring -> collision
    const rings = computeRings(sim, "CENTER", ["A", "B", "X", "D", "E"], CUTOFFS);
    expect(rings).toBeNull();
  });
});

describe("buildPuzzle + gate", () => {
  it("builds a valid puzzle with distinct rings", () => {
    const p = buildPuzzle(sim, "CENTER", ["A", "B", "C", "D", "E"], CUTOFFS, "puz-0000");
    expect(p).not.toBeNull();
    expect(p!.ringCount).toBe(5);
    expect(() => assertPuzzleValid(p!)).not.toThrow();
    expect(p!.words).not.toContain("CENTER"); // center never shipped
  });
});

describe("share (spoiler-safe)", () => {
  const state: AttemptState = {
    puzzleId: "puz-0000",
    dayId: "2026-07-25",
    placement: [0, 1, 2, 3, 4],
    attempts: 2,
    isSolved: true,
    history: [3, 5],
  };
  const words = ["LUNG", "IMPACT", "PREDICT", "FALSE", "ARTIST"];
  it("never contains a word", () => {
    const text = buildShareText(state, "2026-07-25");
    expect(isSpoilerSafe(text, [...words, "CENTER"])).toBe(true);
    for (const w of words) expect(text).not.toContain(w);
  });
  it("shows day id and tries", () => {
    const text = buildShareText(state, "2026-07-25");
    expect(text).toContain("Isobar 2026-07-25");
    expect(text).toContain("2 tries");
  });
});
