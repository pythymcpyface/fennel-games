import { describe, it, expect } from "vitest";
import { normalize, boardDegree, initAttempt, submit, canSubmit } from "../src/games/web-hub/engine.ts";
import { ATTEMPTS_TOTAL } from "../src/games/web-hub/types.ts";
import type { Puzzle } from "../src/games/web-hub/types.ts";

// hub "aced" links to aces/acid/awed/iced (degree 4); others link to <= 2.
const adjacency: Record<string, string[]> = {
  aced: ["aces", "acid", "awed", "iced"],
  aces: ["aced"],
  acid: ["aced"],
  awed: ["aced"],
  iced: ["aced"],
  lewd: [],
  nits: [],
  vend: [],
};
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  board: ["aced", "aces", "acid", "awed", "iced", "lewd", "nits", "vend"],
  hub: "aced",
  degrees: { aced: 4, aces: 1, acid: 1, awed: 1, iced: 1, lewd: 0, nits: 0, vend: 0 },
  adjacency,
};

describe("normalize / boardDegree", () => {
  it("normalizes", () => expect(normalize(" Aced! ")).toBe("aced"));
  it("computes within-board degree", () => {
    expect(boardDegree("aced", adjacency)).toBe(4);
    expect(boardDegree("lewd", adjacency)).toBe(0);
  });
});

describe("submit", () => {
  it("wins on the hub", () => {
    const out = submit(initAttempt(puzzle, "d"), puzzle, "aced");
    expect(out.correct).toBe(true);
    expect(out.state.status).toBe("won");
    expect(out.guess?.degree).toBe(4);
  });

  it("wrong pick returns its degree and consumes a try", () => {
    const out = submit(initAttempt(puzzle, "d"), puzzle, "aces");
    expect(out.correct).toBe(false);
    expect(out.guess?.degree).toBe(1);
    expect(out.state.attemptsRemaining).toBe(ATTEMPTS_TOTAL - 1);
  });

  it("rejects a word not on the board", () => {
    expect(submit(initAttempt(puzzle, "d"), puzzle, "zzzz").error).toBe("unknown_word");
  });

  it("rejects repeat guesses", () => {
    let st = initAttempt(puzzle, "d");
    st = submit(st, puzzle, "aces").state;
    expect(submit(st, puzzle, "aces").error).toBe("already_guessed");
  });

  it("loses after exhausting attempts", () => {
    let st = initAttempt(puzzle, "d");
    for (const w of ["aces", "acid", "awed"]) st = submit(st, puzzle, w).state;
    expect(st.status).toBe("lost");
    expect(canSubmit(st)).toBe(false);
    expect(submit(st, puzzle, "aced").error).toBe("no_attempts_remaining");
  });
});
