import { describe, it, expect } from "vitest";
import { initAttempt, toggleFlag, submit, scoreAudit, canSubmit } from "../src/games/fault-lines/engine.ts";
import type { Puzzle } from "../src/games/fault-lines/types.ts";

// 4 entries; faults at indexes 1 and 3 (faultCount = 2).
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  rows: 4,
  cols: 5,
  blocks: [],
  letters: [],
  faultCount: 2,
  entries: [
    { entryId: "A-1", number: 1, direction: "ACROSS", clue: "c1", displayedAnswer: "OCEAN", cells: [0, 1, 2, 3, 4], isFaulty: false },
    { entryId: "A-2", number: 2, direction: "ACROSS", clue: "c2", displayedAnswer: "MELON", cells: [5, 6, 7, 8, 9], isFaulty: true },
    { entryId: "A-3", number: 3, direction: "ACROSS", clue: "c3", displayedAnswer: "THREE", cells: [10, 11, 12, 13, 14], isFaulty: false },
    { entryId: "A-4", number: 4, direction: "ACROSS", clue: "c4", displayedAnswer: "MANGO", cells: [15, 16, 17, 18, 19], isFaulty: true },
  ],
};

describe("fault-lines engine — flagging", () => {
  it("starts with no flags and not complete", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    expect(s.flags).toEqual([false, false, false, false]);
    expect(s.isComplete).toBe(false);
  });

  it("toggles a single entry's flag without affecting others", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = toggleFlag(s, puzzle, 1).state;
    expect(s.flags).toEqual([false, true, false, false]);
    s = toggleFlag(s, puzzle, 1).state; // toggle back off
    expect(s.flags[1]).toBe(false);
  });

  it("rejects toggling an out-of-range entry", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    expect(toggleFlag(s, puzzle, 9).reason).toBe("out-of-range");
  });

  it("rejects toggling after submission (locked)", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = submit(s, puzzle).state;
    const out = toggleFlag(s, puzzle, 0);
    expect(out.accepted).toBe(false);
    expect(out.reason).toBe("complete");
  });
});

describe("fault-lines engine — scoring", () => {
  it("scores a perfect audit as solved (all faults, no false accusations)", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = toggleFlag(s, puzzle, 1).state;
    s = toggleFlag(s, puzzle, 3).state;
    const r = scoreAudit(s, puzzle);
    expect(r.correctFlags).toBe(2);
    expect(r.falseAccusations).toBe(0);
    expect(r.score).toBe(2);
    expect(r.solved).toBe(true);
    expect(r.correctnessByEntry).toEqual([true, true, true, true]);
  });

  it("penalises false accusations and is not solved", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = toggleFlag(s, puzzle, 0).state; // false accusation (OCEAN is correct)
    s = toggleFlag(s, puzzle, 1).state; // correct fault
    const r = scoreAudit(s, puzzle);
    expect(r.correctFlags).toBe(1);
    expect(r.falseAccusations).toBe(1);
    expect(r.score).toBe(0);
    expect(r.solved).toBe(false);
    // e0 misjudged (flagged but correct), e3 misjudged (fault not flagged).
    expect(r.correctnessByEntry).toEqual([false, true, true, false]);
  });

  it("missing all faults yields score 0 and not solved", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    const r = scoreAudit(s, puzzle);
    expect(r.correctFlags).toBe(0);
    expect(r.score).toBe(0);
    expect(r.solved).toBe(false);
  });

  it("can score negative when false accusations exceed correct flags", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = toggleFlag(s, puzzle, 0).state; // false
    s = toggleFlag(s, puzzle, 2).state; // false
    const r = scoreAudit(s, puzzle);
    expect(r.score).toBe(-2);
  });

  it("submit is idempotent and returns the result once", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = toggleFlag(s, puzzle, 1).state;
    s = toggleFlag(s, puzzle, 3).state;
    const first = submit(s, puzzle);
    expect(first.accepted).toBe(true);
    expect(first.result?.solved).toBe(true);
    s = first.state;
    expect(canSubmit(s)).toBe(false);
    expect(submit(s, puzzle).accepted).toBe(false);
  });
});
