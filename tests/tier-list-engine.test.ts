import { describe, it, expect } from "vitest";
import { initAttempt, submit, canSubmit, countPositions, normalize } from "../src/games/tier-list/engine.ts";
import { ATTEMPTS_TOTAL } from "../src/games/tier-list/types.ts";
import type { Puzzle } from "../src/games/tier-list/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  words: ["absent", "fact", "huckster", "meerkats", "premised"],
  order: ["fact", "absent", "premised", "huckster", "meerkats"],
  tiers: { fact: 10, absent: 20, premised: 35, huckster: 50, meerkats: 70 },
};

describe("normalize / countPositions", () => {
  it("normalizes casing", () => expect(normalize(" Fact! ")).toBe("fact"));
  it("counts correct positions", () => {
    expect(countPositions(puzzle.order, puzzle.order)).toBe(5);
    const twoSwapped = ["absent", "fact", "premised", "huckster", "meerkats"];
    expect(countPositions(twoSwapped, puzzle.order)).toBe(3);
  });
});

describe("submit", () => {
  it("wins on the exact order", () => {
    const out = submit(initAttempt(puzzle, "d"), puzzle, puzzle.order);
    expect(out.correct).toBe(true);
    expect(out.state.status).toBe("won");
    expect(out.attempt?.correctPositions).toBe(5);
  });

  it("rejects wrong-length orderings", () => {
    expect(submit(initAttempt(puzzle, "d"), puzzle, ["fact", "absent"]).error).toBe("wrong_length");
  });

  it("rejects orderings with unknown or duplicate words", () => {
    expect(submit(initAttempt(puzzle, "d"), puzzle, ["fact", "fact", "absent", "premised", "huckster"]).error).toBe("unknown_word");
    expect(submit(initAttempt(puzzle, "d"), puzzle, ["fact", "absent", "premised", "huckster", "zzzz"]).error).toBe("unknown_word");
  });

  it("reports partial correctness and consumes a try", () => {
    const twoSwapped = ["absent", "fact", "premised", "huckster", "meerkats"];
    const out = submit(initAttempt(puzzle, "d"), puzzle, twoSwapped);
    expect(out.attempt?.correctPositions).toBe(3);
    expect(out.state.attemptsRemaining).toBe(ATTEMPTS_TOTAL - 1);
  });

  it("loses after exhausting attempts", () => {
    let st = initAttempt(puzzle, "d");
    const wrong = ["meerkats", "huckster", "premised", "absent", "fact"]; // fully reversed => 1 correct (middle)
    for (let i = 0; i < ATTEMPTS_TOTAL; i++) st = submit(st, puzzle, wrong).state;
    expect(st.status).toBe("lost");
    expect(canSubmit(st)).toBe(false);
    expect(submit(st, puzzle, puzzle.order).error).toBe("no_attempts_remaining");
  });
});
