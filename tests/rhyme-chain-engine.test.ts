import { describe, it, expect } from "vitest";
import { normalizeEntry, rhymes, previousWord, currentSlotIndex, initAttempt, submit, canSubmit } from "../src/games/rhyme-chain/engine.ts";
import { applyHint } from "../src/games/rhyme-chain/hint.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/rhyme-chain/share.ts";
import type { Puzzle, RhymeDict } from "../src/games/rhyme-chain/types.ts";

// rime keys: words sharing a key rhyme.
const dict: RhymeDict = {
  light: "AIT", right: "AIT", kite: "AIT", fight: "AIT", night: "AIT",
  cat: "AT", hat: "AT", bat: "AT",
  dog: "OG", frog: "OG",
};

// seed "light" → right → kite (all rhyme AIT)
const puzzle: Puzzle = {
  puzzleId: "puz-0001",
  seedWord: "light",
  slots: [
    { clue: "opposite of wrong", answer: "right" },
    { clue: "a flying toy", answer: "kite" },
  ],
};

describe("normalizeEntry (REQ-004)", () => {
  it("trims, lowercases, strips non a-z/'", () => {
    expect(normalizeEntry("  Right! ")).toBe("right");
    expect(normalizeEntry("KITE")).toBe("kite");
  });
});

describe("rhymes (REQ-006)", () => {
  it("true iff same rime key and both known", () => {
    expect(rhymes("light", "right", dict)).toBe(true);
    expect(rhymes("light", "cat", dict)).toBe(false);
    expect(rhymes("light", "zzz", dict)).toBe(false);
  });
});

describe("chain helpers", () => {
  it("previousWord is seed for slot 1, last chain word after", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(previousWord(a, puzzle)).toBe("light");
    expect(currentSlotIndex(a)).toBe(0);
    const a2 = { ...a, chainWords: ["right"] };
    expect(previousWord(a2, puzzle)).toBe("right");
    expect(currentSlotIndex(a2)).toBe(1);
  });
});

describe("submit (REQ-005..014)", () => {
  it("accepts a rhyming, intended answer and advances", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, "right", dict);
    expect(out.accepted).toBe(true);
    expect(out.state.chainWords).toEqual(["right"]);
    expect(out.state.attemptsUsedForSlot).toBe(0);
  });

  it("TEST-012: rhymes but wrong answer => not accepted, attempt consumed, feedback RHYMES", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, "night", dict); // rhymes with light, but intended is 'right'
    expect(out.accepted).toBe(false);
    expect(out.feedback?.rhyme).toBe("RHYMES");
    expect(out.feedback?.word).toBe("REAL_WORD");
    expect(out.state.attemptsUsedForSlot).toBe(1);
  });

  it("TEST-015: does not rhyme => feedback DOES_NOT_RHYME", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, "cat", dict);
    expect(out.feedback?.rhyme).toBe("DOES_NOT_RHYME");
  });

  it("TEST-017: unknown word => NOT_IN_DICTIONARY + UNKNOWN rhyme", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, "zzzq", dict);
    expect(out.feedback?.word).toBe("NOT_IN_DICTIONARY");
    expect(out.feedback?.rhyme).toBe("UNKNOWN");
  });

  it("TEST-018: completing the last slot wins", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, "right", dict).state;
    const out = submit(a, puzzle, "kite", dict);
    expect(out.won).toBe(true);
    expect(out.state.outcome).toBe("won");
  });

  it("TEST-019: exhausting attempts loses", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    for (let i = 0; i < 4; i++) a = submit(a, puzzle, "cat", dict).state;
    expect(a.outcome).toBe("lost");
    expect(canSubmit(a)).toBe(false);
  });

  it("is pure (prev unchanged)", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    submit(a, puzzle, "right", dict);
    expect(a.chainWords).toHaveLength(0);
  });
});

describe("hint (REQ-015)", () => {
  it("reveals the first letter of the current answer, once per slot", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const h = applyHint(a, puzzle)!;
    expect(h.letter).toBe("r");
    expect(h.state.hintUsedForSlot).toBe(true);
    expect(applyHint(h.state, puzzle)).toBeNull();
  });
});

describe("share (REQ-016)", () => {
  it("shows chain length blocks, spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, "right", dict).state;
    const text = buildShareText(a, puzzle, "2024-04-01");
    expect(text).toContain("Rhyme Chain 2024-04-01 1/2");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(text.toLowerCase()).not.toContain("right");
    expect(text.toLowerCase()).not.toContain("kite");
  });

  it("isSpoilerSafe flags leaks of clue or answer", () => {
    expect(isSpoilerSafe("answer right", puzzle)).toBe(false);
    expect(isSpoilerSafe("opposite of wrong", puzzle)).toBe(false);
  });
});
