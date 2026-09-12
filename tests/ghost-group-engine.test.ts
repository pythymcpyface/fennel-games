import { describe, it, expect } from "vitest";
import {
  initAttempt,
  matchCategory,
  submitGroup,
  allGroupsSolved,
  pickGhostLabel,
  givenCategories,
  ghostCategory,
} from "../src/games/ghost-group/engine.ts";
import type { Puzzle } from "../src/games/ghost-group/types.ts";

// 16 words in 4 groups of 4 (indices 0-3, 4-7, 8-11, 12-15); group 3 (12-15) is ghost.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  words: ["A0", "A1", "A2", "A3", "B0", "B1", "B2", "B3", "C0", "C1", "C2", "C3", "G0", "G1", "G2", "G3"],
  categories: [
    { id: "cat-0", label: "Alpha", wordIdx: [0, 1, 2, 3], isGhost: false },
    { id: "cat-1", label: "Beta", wordIdx: [4, 5, 6, 7], isGhost: false },
    { id: "cat-2", label: "Gamma", wordIdx: [8, 9, 10, 11], isGhost: false },
    { id: "cat-3", label: "GhostCat", wordIdx: [12, 13, 14, 15], isGhost: true },
  ],
  ghostCandidates: ["GhostCat", "Wrong1", "Wrong2"],
};

describe("category helpers", () => {
  it("ghostCategory + givenCategories split correctly", () => {
    expect(ghostCategory(puzzle).id).toBe("cat-3");
    expect(givenCategories(puzzle).map((c) => c.id)).toEqual(["cat-0", "cat-1", "cat-2"]);
  });
  it("matchCategory finds a group regardless of selection order", () => {
    expect(matchCategory([3, 1, 0, 2], puzzle)?.id).toBe("cat-0");
    expect(matchCategory([0, 1, 2, 4], puzzle)).toBeNull(); // mixed
  });
});

describe("submitGroup", () => {
  it("solves a correct group", () => {
    const s0 = initAttempt(puzzle, "d");
    const out = submitGroup(s0, puzzle, [0, 1, 2, 3]);
    expect(out.correct).toBe(true);
    expect(out.state.solved).toContain("cat-0");
    expect(out.state.history).toEqual([true]);
  });
  it("consumes a mistake on a wrong group", () => {
    const s0 = initAttempt(puzzle, "d");
    const out = submitGroup(s0, puzzle, [0, 1, 2, 4]);
    expect(out.correct).toBe(false);
    expect(out.state.mistakes).toBe(1);
    expect(out.state.history).toEqual([false]);
  });
  it("rejects wrong size and already-solved", () => {
    let s = initAttempt(puzzle, "d");
    expect(submitGroup(s, puzzle, [0, 1, 2]).reason).toBe("size");
    s = submitGroup(s, puzzle, [0, 1, 2, 3]).state;
    expect(submitGroup(s, puzzle, [0, 1, 2, 3]).reason).toBe("already");
  });
  it("loses after 4 mistakes", () => {
    let s = initAttempt(puzzle, "d");
    const wrongs = [[0, 1, 2, 4], [0, 1, 2, 5], [0, 1, 2, 6], [0, 1, 2, 7]];
    for (const w of wrongs) s = submitGroup(s, puzzle, w).state;
    expect(s.mistakes).toBe(4);
    expect(s.playState).toBe("lost");
    expect(submitGroup(s, puzzle, [0, 1, 2, 3]).reason).toBe("terminal");
  });
});

describe("ghost naming", () => {
  function solveAllGroups() {
    let s = initAttempt(puzzle, "d");
    for (const g of [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]]) {
      s = submitGroup(s, puzzle, g).state;
    }
    return s;
  }
  it("requires all groups solved before naming", () => {
    const s0 = initAttempt(puzzle, "d");
    const after = pickGhostLabel(s0, puzzle, "GhostCat");
    expect(after.ghostPick).toBeNull(); // not allowed yet
  });
  it("wins on correct ghost label", () => {
    const s = solveAllGroups();
    expect(allGroupsSolved(s, puzzle)).toBe(true);
    const won = pickGhostLabel(s, puzzle, "GhostCat");
    expect(won.ghostCorrect).toBe(true);
    expect(won.playState).toBe("won");
  });
  it("stays in progress on wrong ghost label", () => {
    const s = solveAllGroups();
    const wrong = pickGhostLabel(s, puzzle, "Wrong1");
    expect(wrong.ghostCorrect).toBe(false);
    expect(wrong.playState).toBe("in_progress");
  });
  it("rejects a label not in candidates", () => {
    const s = solveAllGroups();
    const bad = pickGhostLabel(s, puzzle, "NotAnOption");
    expect(bad.ghostPick).toBeNull();
  });

  // Regression: the real UI never submits the ghost group — players solve the three
  // GIVEN groups then NAME the ghost. Solving only the given groups must open the
  // ghost-naming gate and allow a win. (Bug: allGroupsSolved required all 4 solved.)
  it("opens ghost naming after only the GIVEN groups are solved", () => {
    let s = initAttempt(puzzle, "d");
    for (const g of [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]]) {
      s = submitGroup(s, puzzle, g).state;
    }
    expect(s.solved).toHaveLength(3);
    expect(allGroupsSolved(s, puzzle)).toBe(true); // ghost naming now available
    const won = pickGhostLabel(s, puzzle, "GhostCat");
    expect(won.playState).toBe("won");
  });
});
