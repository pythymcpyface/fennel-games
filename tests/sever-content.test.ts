import { describe, it, expect } from "vitest";
import {
  enumerateSegmentations,
  scoreSegmentation,
  isDominant,
  buildPuzzles,
  assertPuzzlesValid,
  type GateModel,
} from "../src/games/sever/content-build.ts";

const dict = new Set([
  "THERAPIST", "FINISHED", "THE", "RAPIST", "PEN", "ISLAND", "PENIS", "LAND",
  "A", "MAN", "PLAN", "CANAL",
]);

const model: GateModel = {
  unigram: { THERAPIST: 5, FINISHED: 5, THE: 6, RAPIST: 1, PEN: 3, ISLAND: 4, PENIS: 2, LAND: 3, MAN: 4, PLAN: 3, CANAL: 2, A: 6 },
  bigram: { "THERAPIST FINISHED": 3, "THE RAPIST": 0.2, "PEN ISLAND": 2, "PENIS LAND": 0.1 },
  dominanceMargin: 0.15,
};

describe("enumerateSegmentations", () => {
  it("finds all dictionary segmentations", () => {
    const segs = enumerateSegmentations("THERAPISTFINISHED", dict);
    const asStr = segs.map((s) => s.join(" "));
    expect(asStr).toContain("THERAPIST FINISHED");
    expect(asStr).toContain("THE RAPIST FINISHED");
  });
});

describe("scoreSegmentation", () => {
  it("prefers the more frequent reading", () => {
    const good = scoreSegmentation(["THERAPIST", "FINISHED"], model.bigram, model.unigram);
    const bad = scoreSegmentation(["THE", "RAPIST", "FINISHED"], model.bigram, model.unigram);
    expect(good).toBeGreaterThan(bad);
  });
});

describe("isDominant (TERM-030, EDGE-007)", () => {
  it("accepts a phrase whose intended reading dominates", () => {
    expect(isDominant("THERAPIST FINISHED", dict, model)).toBe(true);
  });

  it("rejects a phrase where intended reading is not the top score", () => {
    // "PENIS LAND" intended but "PEN ISLAND" scores higher => reject
    expect(isDominant("PENIS LAND", dict, model)).toBe(false);
  });

  it("rejects when an intended token is not in the dictionary", () => {
    expect(isDominant("ZZZ FINISHED", dict, model)).toBe(false);
  });

  it("accepts a single-reading phrase (unambiguous)", () => {
    expect(isDominant("A MAN", dict, model)).toBe(true);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits only dominant phrases with sequential ids", () => {
    const puzzles = buildPuzzles(["THERAPIST FINISHED", "PENIS LAND", "A MAN"], dict, model);
    const strings = puzzles.map((p) => p.puzzleString);
    expect(strings).toContain("THERAPISTFINISHED");
    expect(strings).toContain("AMAN");
    expect(strings).not.toContain("PENISLAND"); // rejected as ambiguous
    for (const p of puzzles) expect(p.puzzleId).toMatch(/^puz-\d{4}$/);
  });

  it("is deterministic", () => {
    const a = buildPuzzles(["A MAN", "THERAPIST FINISHED"], dict, model);
    const b = buildPuzzles(["A MAN", "THERAPIST FINISHED"], dict, model);
    expect(a).toEqual(b);
  });

  it("passes the validity gate", () => {
    const puzzles = buildPuzzles(["THERAPIST FINISHED", "A MAN"], dict, model);
    expect(() => assertPuzzlesValid(puzzles, dict)).not.toThrow();
  });
});
