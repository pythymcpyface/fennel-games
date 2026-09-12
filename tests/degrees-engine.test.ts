import { describe, it, expect } from "vitest";
import { seededShuffle, initAttempt, reorder, correctPositionCount, submit, applyHint, canSubmit } from "../src/games/degrees/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/degrees/share.ts";
import type { Puzzle } from "../src/games/degrees/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0001",
  words: ["cool", "tepid", "warm", "hot", "scorching"], // canonical order
  scaleLabel: "temperature",
};

describe("seededShuffle", () => {
  it("is a deterministic permutation of 0..n-1", () => {
    const a = seededShuffle(5, "seed-x");
    const b = seededShuffle(5, "seed-x");
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it("does not return the solved identity", () => {
    const a = seededShuffle(5, "seed-x");
    expect(a.every((v, i) => v === i)).toBe(false);
  });
});

describe("correctPositionCount (REQ-005)", () => {
  it("TEST-008/009: counts matching slots", () => {
    expect(correctPositionCount([0, 1, 2, 3, 4])).toBe(5);
    expect(correctPositionCount([0, 1, 2, 4, 3])).toBe(3);
  });
});

describe("submit (REQ-005..010)", () => {
  it("solves when order is canonical", () => {
    const a = { ...initAttempt(puzzle, "2024-04-01"), order: [0, 1, 2, 3, 4] };
    const out = submit(a);
    expect(out.solved).toBe(true);
    expect(out.state.status).toBe("solved");
  });
  it("counts correct positions and consumes an attempt when wrong", () => {
    const a = { ...initAttempt(puzzle, "2024-04-01"), order: [1, 0, 2, 3, 4] };
    const out = submit(a);
    expect(out.solved).toBe(false);
    expect(out.correct).toBe(3);
    expect(out.state.attemptsUsed).toBe(1);
    expect(out.state.history).toEqual([3]);
  });
  it("TEST-015: fails after attempt limit", () => {
    let a = { ...initAttempt(puzzle, "2024-04-01"), order: [1, 0, 2, 3, 4] };
    for (let i = 0; i < 6; i++) a = submit(a).state;
    expect(a.status).toBe("failed");
    expect(canSubmit(a)).toBe(false);
  });
  it("no-op after terminal", () => {
    let a = { ...initAttempt(puzzle, "2024-04-01"), order: [0, 1, 2, 3, 4] };
    a = submit(a).state;
    expect(submit(a).state.attemptsUsed).toBe(a.attemptsUsed);
  });
});

describe("reorder (REQ-004)", () => {
  it("moves an item and stays a permutation", () => {
    const a = { ...initAttempt(puzzle, "2024-04-01"), order: [0, 1, 2, 3, 4], lockedPositions: [false, false, false, false, false] };
    const b = reorder(a, 0, 4);
    expect([...b.order].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(b.order).toEqual([1, 2, 3, 4, 0]);
  });
  it("rejects moves involving a locked slot", () => {
    const a = { ...initAttempt(puzzle, "2024-04-01"), order: [0, 1, 2, 3, 4], lockedPositions: [true, false, false, false, false] };
    expect(reorder(a, 0, 3)).toBe(a);
  });
});

describe("applyHint (REQ-011)", () => {
  it("TEST-017: locks slot 0 to its canonical word", () => {
    const a = { ...initAttempt(puzzle, "2024-04-01"), order: [3, 1, 2, 0, 4], lockedPositions: [false, false, false, false, false] };
    const h = applyHint(a)!;
    expect(h.order[0]).toBe(0);
    expect(h.lockedPositions[0]).toBe(true);
    expect(h.hintUses).toBe(1);
  });
  it("TEST-018: next hint locks slot 1", () => {
    let a = { ...initAttempt(puzzle, "2024-04-01"), order: [3, 1, 2, 0, 4], lockedPositions: [false, false, false, false, false] };
    a = applyHint(a)!;
    a = applyHint(a)!;
    expect(a.lockedPositions[1]).toBe(true);
    expect(a.order[1]).toBe(1);
  });
});

describe("share (REQ-013/014)", () => {
  it("encodes counts, spoiler-safe", () => {
    let a = { ...initAttempt(puzzle, "2024-04-01"), order: [1, 0, 2, 3, 4] };
    a = submit(a).state; // 3 correct
    a = { ...a, order: [0, 1, 2, 3, 4] };
    a = submit(a).state; // solved
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Degrees 2024-04-01 2/6");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(text.toLowerCase()).not.toContain("warm");
    expect(text.toLowerCase()).not.toContain("temperature");
  });
  it("flags leaks", () => {
    expect(isSpoilerSafe("it was warm", puzzle)).toBe(false);
    expect(isSpoilerSafe("scale temperature", puzzle)).toBe(false);
  });
});
