import { describe, it, expect } from "vitest";
import {
  normalizeSubmission,
  visibleMask,
  visibleCount,
  renderWord,
  lockScore,
  initAttempt,
  submit,
  lockedCount,
  lostCount,
  isSolved,
  outcomeTier,
} from "../src/games/decay/engine.ts";
import type { Puzzle } from "../src/games/decay/types.ts";

// Two 3-letter words: CAT (decay order 0,1,2) and DOG (2,1,0). Threshold 2.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  lockThreshold: 2,
  targets: [
    { word: "cat", decayOrder: [0, 1, 2] },
    { word: "dog", decayOrder: [2, 1, 0] },
  ],
};

describe("decay engine — masks & helpers", () => {
  it("normalizeSubmission trims, lowercases, strips non-letters", () => {
    expect(normalizeSubmission(" C4a-T! ")).toBe("cat");
  });

  it("visibleMask hides the first `tick` letters per decay order", () => {
    expect(visibleMask(puzzle.targets[0], 0)).toEqual([true, true, true]);
    expect(visibleMask(puzzle.targets[0], 1)).toEqual([false, true, true]); // hides index 0
    expect(visibleMask(puzzle.targets[0], 3)).toEqual([false, false, false]);
    expect(visibleCount(puzzle.targets[0], 2)).toBe(1);
  });

  it("renderWord shows letters or underscores", () => {
    expect(renderWord(puzzle.targets[0], [true, false, true])).toBe("C _ T");
  });

  it("lockScore is the visible count", () => {
    expect(lockScore(3)).toBe(3);
    expect(lockScore(0)).toBe(0);
  });
});

describe("decay engine — submissions & ticks", () => {
  it("empty submission is rejected and does not advance the tick", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    const out = submit(s, puzzle, "  1 ");
    expect(out.accepted).toBe(false);
    expect(out.reason).toBe("empty");
    expect(out.state.tick).toBe(0);
  });

  it("locks a matched word at current visibility, then advances a tick", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    const out = submit(s, puzzle, "CAT");
    s = out.state;
    expect(out.matched).toBe(true);
    expect(s.words[0].status).toBe("LOCKED");
    expect(s.words[0].lockedVisibility).toBe(3); // locked before decay at tick 0
    expect(s.score).toBe(3);
    expect(s.tick).toBe(1);
  });

  it("a wrong submission advances the tick and decays unlocked words", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = submit(s, puzzle, "zzz").state;
    expect(s.tick).toBe(1);
    expect(visibleCount(puzzle.targets[0], s.tick)).toBe(2);
  });

  it("a locked word freezes its visibility (does not decay further)", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = submit(s, puzzle, "CAT").state; // lock at vis 3
    s = submit(s, puzzle, "zzz").state; // advance
    expect(s.words[0].lockedVisibility).toBe(3);
  });

  it("a word fully hidden while unlocked becomes LOST", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    // 3 wrong guesses -> tick 3, both 3-letter words fully hidden.
    s = submit(s, puzzle, "zzz").state;
    s = submit(s, puzzle, "zzz").state;
    s = submit(s, puzzle, "zzz").state;
    expect(s.words[0].status).toBe("LOST");
    expect(s.words[1].status).toBe("LOST");
    expect(lostCount(s)).toBe(2);
  });
});

describe("decay engine — completion", () => {
  it("solves when lockCount reaches the threshold", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = submit(s, puzzle, "CAT").state;
    s = submit(s, puzzle, "DOG").state;
    expect(lockedCount(s)).toBe(2);
    expect(isSolved(s)).toBe(true);
    expect(s.status).toBe("SOLVED");
  });

  it("fails when no unlocked words remain and threshold not met", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = submit(s, puzzle, "zzz").state; // t1
    s = submit(s, puzzle, "zzz").state; // t2
    s = submit(s, puzzle, "zzz").state; // t3 -> both lost
    expect(s.status).toBe("FAILED");
    // Submissions blocked when terminal.
    expect(submit(s, puzzle, "CAT").accepted).toBe(false);
  });

  it("outcomeTier reflects lock visibility and loss", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = submit(s, puzzle, "CAT").state; // locked at full visibility
    expect(outcomeTier(s, puzzle, 0)).toBe("HIGH_LOCK");
    let s2 = initAttempt(puzzle, "2026-01-01");
    s2 = submit(s2, puzzle, "zzz").state;
    s2 = submit(s2, puzzle, "zzz").state;
    s2 = submit(s2, puzzle, "zzz").state;
    expect(outcomeTier(s2, puzzle, 0)).toBe("LOST");
  });
});
