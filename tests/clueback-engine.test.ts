import { describe, it, expect } from "vitest";
import {
  initAttempt,
  select,
  entryStatus,
  isSelectionCorrect,
  correctCount,
  incorrectCount,
  totalEntries,
  isComplete,
  isSolved,
} from "../src/games/clueback/engine.ts";
import type { Puzzle } from "../src/games/clueback/types.ts";

// A fixed 3-entry puzzle. correctIndex chosen per entry.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  entries: [
    { entryId: "e0", answer: "OCEAN", candidates: ["Lake", "Salt water body", "Stream"], correctIndex: 1 },
    { entryId: "e1", answer: "COMET", candidates: ["Icy tailed body", "Planet ring", "Crater"], correctIndex: 0 },
    { entryId: "e2", answer: "MAPLE", candidates: ["Palm", "Shrub", "Syrup tree"], correctIndex: 2 },
  ],
};

describe("clueback engine — selection", () => {
  it("starts with all entries unanswered and not complete", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    expect(s.selections).toEqual([null, null, null]);
    expect(isComplete(s)).toBe(false);
    expect(entryStatus(s, puzzle, 0)).toBe("unanswered");
  });

  it("records a correct selection and marks the entry correct", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    const out = select(s, puzzle, 0, 1);
    expect(out.accepted).toBe(true);
    s = out.state;
    expect(isSelectionCorrect(s, puzzle, 0)).toBe(true);
    expect(entryStatus(s, puzzle, 0)).toBe("answered_correct");
  });

  it("records an incorrect selection and marks the entry incorrect", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = select(s, puzzle, 0, 0).state;
    expect(isSelectionCorrect(s, puzzle, 0)).toBe(false);
    expect(entryStatus(s, puzzle, 0)).toBe("answered_incorrect");
  });

  it("locks after the first selection (idempotent — cannot overwrite)", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = select(s, puzzle, 0, 0).state; // wrong first
    const second = select(s, puzzle, 0, 1); // try to fix
    expect(second.accepted).toBe(false);
    expect(second.reason).toBe("already-answered");
    expect(s.selections[0]).toBe(0);
  });

  it("rejects out-of-range entry and clue indices", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    expect(select(s, puzzle, 5, 0).reason).toBe("out-of-range");
    expect(select(s, puzzle, 0, 3).reason).toBe("bad-index");
    expect(select(s, puzzle, 0, -1).reason).toBe("bad-index");
  });
});

describe("clueback engine — completion & scoring", () => {
  it("completes only when every entry is answered", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = select(s, puzzle, 0, 1).state;
    s = select(s, puzzle, 1, 0).state;
    expect(isComplete(s)).toBe(false);
    s = select(s, puzzle, 2, 2).state;
    expect(isComplete(s)).toBe(true);
    expect(s.isComplete).toBe(true);
  });

  it("rejects further selections once complete", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = select(s, puzzle, 0, 1).state;
    s = select(s, puzzle, 1, 0).state;
    s = select(s, puzzle, 2, 2).state;
    const after = select(s, puzzle, 0, 0);
    expect(after.accepted).toBe(false);
    expect(after.reason).toBe("complete");
  });

  it("counts correct and incorrect selections", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = select(s, puzzle, 0, 1).state; // correct
    s = select(s, puzzle, 1, 1).state; // wrong (correct is 0)
    s = select(s, puzzle, 2, 2).state; // correct
    expect(correctCount(s, puzzle)).toBe(2);
    expect(incorrectCount(s, puzzle)).toBe(1);
    expect(totalEntries(puzzle)).toBe(3);
  });

  it("isSolved requires a clean sweep of all-correct", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = select(s, puzzle, 0, 1).state;
    s = select(s, puzzle, 1, 0).state;
    s = select(s, puzzle, 2, 2).state;
    expect(isSolved(s, puzzle)).toBe(true);

    let s2 = initAttempt(puzzle, "2026-01-02");
    s2 = select(s2, puzzle, 0, 1).state;
    s2 = select(s2, puzzle, 1, 1).state; // one wrong
    s2 = select(s2, puzzle, 2, 2).state;
    expect(isComplete(s2)).toBe(true);
    expect(isSolved(s2, puzzle)).toBe(false);
  });
});
