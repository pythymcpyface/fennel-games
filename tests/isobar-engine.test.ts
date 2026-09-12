import { describe, it, expect } from "vitest";
import {
  initAttempt,
  place,
  isComplete,
  correctCount,
  hints,
  submit,
  canSubmit,
} from "../src/games/isobar/engine.ts";
import type { Puzzle } from "../src/games/isobar/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  ringCount: 5,
  words: ["LUNG", "IMPACT", "PREDICT", "FALSE", "ARTIST"],
  correctRings: [0, 1, 2, 3, 4],
};

describe("placement", () => {
  it("initAttempt has all-null placement", () => {
    const s = initAttempt(puzzle, "d");
    expect(s.placement).toEqual([null, null, null, null, null]);
  });
  it("place sets and clears a ring", () => {
    let s = initAttempt(puzzle, "d");
    s = place(s, 0, 2, puzzle);
    expect(s.placement[0]).toBe(2);
    s = place(s, 0, null, puzzle);
    expect(s.placement[0]).toBeNull();
  });
  it("place rejects out-of-range rings/words", () => {
    let s = initAttempt(puzzle, "d");
    s = place(s, 0, 9, puzzle); // ring OOB
    expect(s.placement[0]).toBeNull();
    s = place(s, 9, 0, puzzle); // word OOB
    expect(s.placement).toEqual([null, null, null, null, null]);
  });
  it("isComplete requires all placed", () => {
    let s = initAttempt(puzzle, "d");
    for (let i = 0; i < 5; i++) s = place(s, i, i, puzzle);
    expect(isComplete(s.placement)).toBe(true);
  });
});

describe("scoring + hints", () => {
  it("correctCount counts exact-ring matches", () => {
    const placement = [0, 1, 2, 4, 3]; // last two swapped
    expect(correctCount(placement, puzzle)).toBe(3);
  });
  it("hints mark correct / off-by-one direction / other", () => {
    // word3 FALSE correct ring 3, placed 4 => p>c => nearer
    // word4 ARTIST correct ring 4, placed 3 => p<c => farther
    const h = hints([0, 1, 2, 4, 3], puzzle);
    expect(h[0].status).toBe("correct");
    expect(h[3]).toEqual({ word: "FALSE", status: "off_by_one", direction: "nearer" });
    expect(h[4]).toEqual({ word: "ARTIST", status: "off_by_one", direction: "farther" });
  });
  it("marks a 2-off placement as other_incorrect", () => {
    const h = hints([2, 1, 2, 3, 4], puzzle); // LUNG placed ring2 vs 0 => diff 2
    expect(h[0].status).toBe("other_incorrect");
  });
});

describe("submit", () => {
  it("rejects incomplete placement", () => {
    const s = initAttempt(puzzle, "d");
    expect(submit(s, puzzle).reason).toBe("incomplete");
  });
  it("solves when all rings correct", () => {
    let s = initAttempt(puzzle, "d");
    for (let i = 0; i < 5; i++) s = place(s, i, i, puzzle);
    const out = submit(s, puzzle);
    expect(out.solved).toBe(true);
    expect(out.correct).toBe(5);
    expect(out.state.isSolved).toBe(true);
    expect(out.state.attempts).toBe(1);
  });
  it("records partial and stays unsolved", () => {
    let s = initAttempt(puzzle, "d");
    const placement = [0, 1, 2, 4, 3];
    placement.forEach((r, i) => { s = place(s, i, r, puzzle); });
    const out = submit(s, puzzle);
    expect(out.solved).toBe(false);
    expect(out.correct).toBe(3);
    expect(out.state.history).toEqual([3]);
  });
  it("canSubmit only when complete and unsolved", () => {
    let s = initAttempt(puzzle, "d");
    expect(canSubmit(s)).toBe(false);
    for (let i = 0; i < 5; i++) s = place(s, i, i, puzzle);
    expect(canSubmit(s)).toBe(true);
  });
});
