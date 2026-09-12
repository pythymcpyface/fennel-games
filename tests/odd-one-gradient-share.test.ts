import { describe, it, expect } from "vitest";
import { heatBlock, buildShareText, isSpoilerSafe } from "../src/games/odd-one-gradient/share.ts";
import { initAttempt, submit } from "../src/games/odd-one-gradient/engine.ts";
import type { Puzzle, WordScore } from "../src/games/odd-one-gradient/types.ts";

function score(word: string, coldness: number, heat: number): WordScore {
  return { word, coldness, heat };
}
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  words: ["apple", "banana", "grape", "hammer", "orange", "peach"],
  odd: "hammer",
  themeLabel: "fruit",
  scores: {
    apple: score("apple", 8, 0), banana: score("banana", 9, 0), grape: score("grape", 27, 1),
    hammer: score("hammer", 255, 4), orange: score("orange", 10, 0), peach: score("peach", 6, 0),
  },
};

describe("heatBlock", () => {
  it("returns green for the correct outlier", () => expect(heatBlock(2, true)).toBe("🟩"));
  it("returns a cold block for a low-heat belonging pick", () => expect(heatBlock(0, false)).toBe("🟦"));
});

describe("buildShareText / isSpoilerSafe", () => {
  it("summarises a win in one tap without leaking words", () => {
    const st = submit(initAttempt(puzzle, "2026-01-01"), puzzle, "hammer").state;
    const text = buildShareText(st, "2026-01-01");
    expect(text).toContain("Odd-One Gradient 2026-01-01");
    expect(text).toContain("1/3");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
  });

  it("flags a leak of a set word or theme", () => {
    expect(isSpoilerSafe("Odd-One Gradient x hammer", puzzle)).toBe(false);
    expect(isSpoilerSafe("Odd-One Gradient x fruit", puzzle)).toBe(false);
  });

  it("marks a loss with X", () => {
    let st = initAttempt(puzzle, "2026-01-01");
    for (const w of ["apple", "banana", "orange"]) st = submit(st, puzzle, w).state;
    expect(buildShareText(st, "2026-01-01")).toContain("X/3");
  });
});
