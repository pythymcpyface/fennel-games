import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { assertCountryPuzzlesValid } from "../src/games/lowball/content-build.ts";
import { matchesAffix } from "../src/games/lowball/types.ts";
import type { Puzzle } from "../src/games/lowball/types.ts";

// Integration test for the generated public/lowball-countries.json pack.
// These tests are skipped when the pack has not been generated yet
// (run `npm run gen:lowball-countries` to produce it).

const PACK_PATH = "public/lowball-countries.json";
const packExists = existsSync(PACK_PATH);

const describeWithPack = packExists ? describe : describe.skip;

const pack = packExists
  ? (JSON.parse(readFileSync(PACK_PATH, "utf8")) as {
      contentPackVersion: string;
      datasetId: string;
      puzzleCount: number;
      puzzles: Puzzle[];
    })
  : { contentPackVersion: "", datasetId: "", puzzleCount: 0, puzzles: [] };

describeWithPack("lowball-countries.json — structural soundness", () => {
  it("passes assertCountryPuzzlesValid", () => {
    expect(() => assertCountryPuzzlesValid(pack.puzzles)).not.toThrow();
  });

  it("puzzleCount matches actual puzzles array length", () => {
    expect(pack.puzzles).toHaveLength(pack.puzzleCount);
  });

  it("ships at least one puzzle", () => {
    expect(pack.puzzles.length).toBeGreaterThan(0);
  });

  it("every puzzle has a categoryDomain of 'countries'", () => {
    for (const p of pack.puzzles) {
      expect((p as unknown as Record<string, unknown>)["categoryDomain"]).toBe("countries");
    }
  });

  it("every puzzle has par > 0", () => {
    for (const p of pack.puzzles) {
      expect(p.parValue).toBeGreaterThan(0);
    }
  });

  it("every answer satisfies matchesAffix for its puzzle", () => {
    const violations: string[] = [];
    for (const p of pack.puzzles) {
      for (const a of p.answers) {
        if (!matchesAffix(a.word, p.affixType, p.affixValue)) {
          violations.push(`${p.puzzleId} ${p.affixType}:${p.affixValue} -> ${a.word}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("puzzle IDs are sequential and unique", () => {
    const ids = pack.puzzles.map((p) => p.puzzleId);
    const expected = pack.puzzles.map((_, i) => `puz-${String(i).padStart(4, "0")}`);
    expect(ids).toEqual(expected);
  });

  it("no puzzle has duplicate answer words", () => {
    for (const p of pack.puzzles) {
      const seen = new Set<string>();
      for (const a of p.answers) {
        expect(seen.has(a.word)).toBe(false);
        seen.add(a.word);
      }
    }
  });

  it("answer objects carry only word, panelScore, isFindable", () => {
    for (const p of pack.puzzles) {
      for (const a of p.answers) {
        expect(Object.keys(a).sort()).toEqual(["isFindable", "panelScore", "word"]);
      }
    }
  });

  it("every categoryLabel starts with 'Countries'", () => {
    for (const p of pack.puzzles) {
      expect(p.categoryLabel).toMatch(/^Countries /);
    }
  });
});
