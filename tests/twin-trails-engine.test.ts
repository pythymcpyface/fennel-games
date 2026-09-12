import { describe, it, expect } from "vitest";
import { initAttempt, submit, canSubmit, countCorrect, isComplete } from "../src/games/twin-trails/engine.ts";
import { ATTEMPTS_TOTAL, type Side } from "../src/games/twin-trails/types.ts";
import type { Puzzle } from "../src/games/twin-trails/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  words: ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"],
  gold: { a1: "A", a2: "A", a3: "A", a4: "A", b1: "B", b2: "B", b3: "B", b4: "B" },
  labelA: "sea",
  labelB: "woods",
};
const correct: Record<string, Side> = { ...puzzle.gold };
const twoWrong: Record<string, Side> = { ...puzzle.gold, a1: "B", b1: "A" };

describe("countCorrect / isComplete", () => {
  it("counts matches against gold", () => {
    expect(countCorrect(correct, puzzle.gold)).toBe(8);
    expect(countCorrect(twoWrong, puzzle.gold)).toBe(6);
  });
  it("detects an incomplete assignment", () => {
    const partial: Record<string, Side> = { a1: "A" };
    expect(isComplete(partial, puzzle.words)).toBe(false);
    expect(isComplete(correct, puzzle.words)).toBe(true);
  });
});

describe("submit", () => {
  it("wins on a fully correct split", () => {
    const out = submit(initAttempt(puzzle, "d"), puzzle, correct);
    expect(out.correct).toBe(true);
    expect(out.state.status).toBe("won");
    expect(out.attempt?.correctCount).toBe(8);
  });

  it("rejects an incomplete assignment without consuming a try", () => {
    const st = initAttempt(puzzle, "d");
    const out = submit(st, puzzle, { a1: "A" });
    expect(out.error).toBe("incomplete");
    expect(out.state.attemptsRemaining).toBe(ATTEMPTS_TOTAL);
  });

  it("reports partial correctness and consumes a try", () => {
    const out = submit(initAttempt(puzzle, "d"), puzzle, twoWrong);
    expect(out.correct).toBe(false);
    expect(out.attempt?.correctCount).toBe(6);
    expect(out.state.attemptsRemaining).toBe(ATTEMPTS_TOTAL - 1);
  });

  it("loses after exhausting attempts", () => {
    let st = initAttempt(puzzle, "d");
    for (let i = 0; i < ATTEMPTS_TOTAL; i++) st = submit(st, puzzle, twoWrong).state;
    expect(st.status).toBe("lost");
    expect(canSubmit(st)).toBe(false);
    expect(submit(st, puzzle, correct).error).toBe("no_attempts_remaining");
  });
});
