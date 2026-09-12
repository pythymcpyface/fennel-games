import { describe, it, expect } from "vitest";
import { normalize, initAttempt, submit, canSubmit } from "../src/games/odd-one-gradient/engine.ts";
import { ATTEMPTS_TOTAL } from "../src/games/odd-one-gradient/types.ts";
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
    apple: score("apple", 8, 0),
    banana: score("banana", 9, 0),
    grape: score("grape", 27, 1),
    hammer: score("hammer", 255, 4),
    orange: score("orange", 10, 0),
    peach: score("peach", 6, 0),
  },
};

describe("normalize", () => {
  it("lowercases and strips", () => expect(normalize(" Hammer! ")).toBe("hammer"));
});

describe("submit", () => {
  it("wins when tapping the odd one", () => {
    const out = submit(initAttempt(puzzle, "d"), puzzle, "hammer");
    expect(out.correct).toBe(true);
    expect(out.state.status).toBe("won");
    expect(out.guess?.heat).toBe(4);
  });

  it("wrong (belonging) pick costs an attempt and returns its heat", () => {
    const out = submit(initAttempt(puzzle, "d"), puzzle, "apple");
    expect(out.correct).toBe(false);
    expect(out.guess?.heat).toBe(0);
    expect(out.state.attemptsRemaining).toBe(ATTEMPTS_TOTAL - 1);
  });

  it("rejects a word not in the set", () => {
    expect(submit(initAttempt(puzzle, "d"), puzzle, "zebra").error).toBe("unknown_word");
  });

  it("rejects repeat guesses", () => {
    let st = initAttempt(puzzle, "d");
    st = submit(st, puzzle, "apple").state;
    expect(submit(st, puzzle, "apple").error).toBe("already_guessed");
  });

  it("loses after exhausting attempts", () => {
    let st = initAttempt(puzzle, "d");
    for (const w of ["apple", "banana", "orange"]) st = submit(st, puzzle, w).state;
    expect(st.status).toBe("lost");
    expect(canSubmit(st)).toBe(false);
    expect(submit(st, puzzle, "hammer").error).toBe("no_attempts_remaining");
  });
});
