import { describe, it, expect } from "vitest";
import { internalEdges, initAttempt, submit, canSubmit, normalize } from "../src/games/edit-clusters/engine.ts";
import { ATTEMPTS_TOTAL } from "../src/games/edit-clusters/types.ts";
import type { Puzzle } from "../src/games/edit-clusters/types.ts";

// A board where cluster {bare,care,dare,fare} is the unique densest 4-subset.
const adjacency: Record<string, string[]> = {
  bare: ["care", "dare", "fare"],
  care: ["bare", "dare", "fare"],
  dare: ["bare", "care", "fare"],
  fare: ["bare", "care", "dare"],
  airy: [],
  lies: [],
  offs: [],
  tame: [],
  wist: [],
};
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  board: ["airy", "bare", "care", "dare", "fare", "lies", "offs", "tame", "wist"],
  cluster: ["bare", "care", "dare", "fare"],
  maxEdges: 6,
  adjacency,
};

describe("normalize", () => {
  it("lowercases and strips non-letters", () => {
    expect(normalize("  Bare! ")).toBe("bare");
  });
});

describe("internalEdges", () => {
  it("counts the 6 edges of a 4-clique", () => {
    expect(internalEdges(["bare", "care", "dare", "fare"], adjacency)).toBe(6);
  });
  it("counts fewer edges when a decoy replaces a member", () => {
    expect(internalEdges(["bare", "care", "dare", "airy"], adjacency)).toBe(3);
  });
  it("counts zero for all-decoy selections", () => {
    expect(internalEdges(["airy", "lies", "offs", "tame"], adjacency)).toBe(0);
  });
});

describe("submit", () => {
  it("wins on the exact densest cluster", () => {
    const st = initAttempt(puzzle, "2026-01-01");
    const out = submit(st, puzzle, ["fare", "dare", "care", "bare"]);
    expect(out.correct).toBe(true);
    expect(out.state.status).toBe("won");
    expect(out.attempt?.edges).toBe(6);
  });

  it("rejects wrong-size selections", () => {
    const st = initAttempt(puzzle, "2026-01-01");
    expect(submit(st, puzzle, ["bare", "care"]).error).toBe("wrong_size");
  });

  it("rejects words not on the board", () => {
    const st = initAttempt(puzzle, "2026-01-01");
    expect(submit(st, puzzle, ["bare", "care", "dare", "zzzz"]).error).toBe("unknown_word");
  });

  it("rejects a repeated selection", () => {
    let st = initAttempt(puzzle, "2026-01-01");
    st = submit(st, puzzle, ["bare", "care", "dare", "airy"]).state;
    expect(submit(st, puzzle, ["airy", "bare", "care", "dare"]).error).toBe("already_tried");
  });

  it("loses after exhausting attempts", () => {
    let st = initAttempt(puzzle, "2026-01-01");
    const wrong = [
      ["bare", "care", "dare", "airy"],
      ["bare", "care", "dare", "lies"],
      ["bare", "care", "dare", "offs"],
      ["bare", "care", "dare", "tame"],
    ];
    for (const g of wrong) st = submit(st, puzzle, g).state;
    expect(st.status).toBe("lost");
    expect(canSubmit(st)).toBe(false);
    expect(st.attemptsRemaining).toBe(0);
  });

  it("blocks submissions once terminal", () => {
    let st = initAttempt(puzzle, "2026-01-01");
    st = submit(st, puzzle, ["bare", "care", "dare", "fare"]).state;
    const out = submit(st, puzzle, ["airy", "lies", "offs", "tame"]);
    expect(out.error).toBe("no_attempts_remaining");
  });

  it("starts with full attempts", () => {
    expect(initAttempt(puzzle, "d").attemptsRemaining).toBe(ATTEMPTS_TOTAL);
  });
});
