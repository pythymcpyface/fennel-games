import { describe, it, expect } from "vitest";
import { packBoard, validatePuzzle, isValidLadder, mulberry32, neighbours, type PackInput } from "../src/games/edit-ladder-trails/content-build.ts";
import type { Puzzle } from "../src/games/edit-ladder-trails/types.ts";

describe("neighbours (8-direction, edge-clamped)", () => {
  it("corner cell 0 has 3 neighbours", () => expect(neighbours(0).sort((a, b) => a - b)).toEqual([1, 6, 7]));
  it("centre cell 14 has 8 neighbours", () => expect(neighbours(14)).toHaveLength(8));
});

describe("isValidLadder (edit-distance-1 chain)", () => {
  it("accepts a valid 4-rung substitution ladder", () => {
    expect(isValidLadder(["repel", "rebel", "revel", "level"])).toBe(true);
  });
  it("rejects a pair differing by >1 letter", () => {
    expect(isValidLadder(["repel", "rebel", "revel", "loved"])).toBe(false);
  });
  it("rejects wrong count / length / duplicates", () => {
    expect(isValidLadder(["repel", "rebel", "revel"])).toBe(false);
    expect(isValidLadder(["repel", "rebel", "revel", "revel"])).toBe(false);
    expect(isValidLadder(["repel", "rebel", "revel", "levels"])).toBe(false);
  });
});

// The packer is stochastic per seed but deterministic given the seed. Generate a
// board and assert it validates; retry seeds until one packs (mirrors the tool).
function buildOne(): Puzzle | null {
  const input: PackInput = { ladder: ["repel", "rebel", "revel", "level"], spangram: "daughter", filler: ["oxen", "jazz"] };
  for (let r = 0; r < 40; r++) {
    const rand = mulberry32(1000 + r);
    const packed = packBoard(input, rand, { nodes: 200000 });
    if (packed) {
      return { puzzleId: "puz-0000", letters: packed.letters, answers: packed.answers, ladder: input.ladder, spangram: input.spangram };
    }
  }
  return null;
}

describe("packBoard + validatePuzzle (REQ-009, NFR-006/008/009)", () => {
  const puzzle = buildOne();

  it("packs a fair board within budget", () => {
    expect(puzzle).not.toBeNull();
  });

  it("produces a perfect cover of 36 cells (NFR-006)", () => {
    const cover = new Array(36).fill(0);
    for (const a of puzzle!.answers) for (const c of a.path) cover[c]++;
    expect(cover.every((n) => n === 1)).toBe(true);
  });

  it("each placement spells its word along an 8-neighbour path", () => {
    for (const a of puzzle!.answers) {
      expect(a.path).toHaveLength(a.word.length);
      for (let i = 0; i < a.path.length; i++) {
        expect(puzzle!.letters[a.path[i]]).toBe(a.word[i].toUpperCase());
        if (i > 0) expect(neighbours(a.path[i - 1])).toContain(a.path[i]);
      }
    }
  });

  it("spangram spans top row and bottom row (NFR-008/009)", () => {
    const span = puzzle!.answers.find((a) => a.type === "spangram")!;
    const rows = new Set(span.path.map((c) => Math.floor(c / 6)));
    expect(rows.has(0)).toBe(true);
    expect(rows.has(5)).toBe(true);
  });

  it("passes the fairness gate", () => {
    expect(validatePuzzle(puzzle!)).toBeNull();
  });
});

describe("validatePuzzle rejects bad boards", () => {
  const base = buildOne()!;
  it("rejects a spangram missing the bottom row (NFR-009)", () => {
    // move spangram entirely into the top half by truncating its path illegally
    const bad: Puzzle = JSON.parse(JSON.stringify(base));
    const span = bad.answers.find((a) => a.type === "spangram")!;
    span.path = span.path.map((c) => Math.min(c, 17)); // force all cells into rows 0..2 (breaks cover too)
    expect(validatePuzzle(bad)).not.toBeNull();
  });
  it("rejects an invalid ladder", () => {
    const bad: Puzzle = JSON.parse(JSON.stringify(base));
    bad.ladder = ["repel", "rebel", "revel", "loved"];
    expect(validatePuzzle(bad)).toBe("invalid ladder");
  });
});
