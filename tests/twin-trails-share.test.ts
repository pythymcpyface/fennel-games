import { describe, it, expect } from "vitest";
import { countBar, buildShareText, isSpoilerSafe } from "../src/games/twin-trails/share.ts";
import { initAttempt, submit } from "../src/games/twin-trails/engine.ts";
import type { Puzzle, Side } from "../src/games/twin-trails/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  words: ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"],
  gold: { a1: "A", a2: "A", a3: "A", a4: "A", b1: "B", b2: "B", b3: "B", b4: "B" },
  labelA: "sea",
  labelB: "woods",
};
const correct: Record<string, Side> = { ...puzzle.gold };
const twoWrong: Record<string, Side> = { ...puzzle.gold, a1: "B", b1: "A" };

describe("countBar", () => {
  it("fills green for correct and white for the rest", () => {
    expect(countBar(6)).toBe("🟩🟩🟩🟩🟩🟩⬜⬜");
  });
});

describe("buildShareText / isSpoilerSafe", () => {
  it("summarises a win without leaking words or labels", () => {
    const st = submit(initAttempt(puzzle, "2026-01-01"), puzzle, correct).state;
    const text = buildShareText(st, "2026-01-01");
    expect(text).toContain("Twin Trails 2026-01-01");
    expect(text).toContain("1/4");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
  });

  it("records each attempt's correct-count bar", () => {
    let st = initAttempt(puzzle, "2026-01-01");
    st = submit(st, puzzle, twoWrong).state;
    st = submit(st, puzzle, correct).state;
    const text = buildShareText(st, "2026-01-01");
    expect(text.split("\n")).toHaveLength(3); // header + 2 attempts
  });

  it("flags a leak of a label", () => {
    expect(isSpoilerSafe("Twin Trails x sea", puzzle)).toBe(false);
  });

  it("marks a loss with X", () => {
    let st = initAttempt(puzzle, "2026-01-01");
    for (let i = 0; i < 4; i++) st = submit(st, puzzle, twoWrong).state;
    expect(buildShareText(st, "2026-01-01")).toContain("X/4");
  });
});
