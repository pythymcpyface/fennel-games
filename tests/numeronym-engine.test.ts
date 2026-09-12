import { describe, it, expect } from "vitest";
import { normalize, encodings, encodingMatches, initAttempt, submit, applyHint, canSubmit } from "../src/games/numeronym/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/numeronym/share.ts";
import type { Puzzle } from "../src/games/numeronym/types.ts";

describe("encodings (REQ-004/007)", () => {
  it("LATER contains 'ATE' -> L8R", () => {
    expect(encodings("LATER").has("L8R")).toBe(true);
    expect(encodingMatches("LATER", "L8R")).toBe(true);
  });
  it("GRATE -> GR8, TONIGHT -> 2NIGHT, CREATE -> CRE8", () => {
    expect(encodings("GRATE").has("GR8")).toBe(true);
    expect(encodings("TONIGHT").has("2NIGHT")).toBe(true);
    expect(encodings("CREATE").has("CRE8")).toBe(true);
  });
  it("WAIT has no sound-alike fragment -> cannot encode to W8", () => {
    expect(encodingMatches("WAIT", "W8")).toBe(false);
  });
  it("normalize uppercases + strips", () => {
    expect(normalize(" later! ")).toBe("LATER");
  });
});

// Self-consistent puzzle: each clue is a genuine encoding of its answer.
const p2: Puzzle = {
  puzzleId: "p",
  clues: ["L8R", "GR8", "BE4E", "2NIGHT", "CRE8"],
  answers: ["LATER", "GRATE", "BEFORE", "TONIGHT", "CREATE"],
  themeLabel: "Texting",
};
const d2 = new Set(["LATER", "GRATE", "BEFORE", "TONIGHT", "CREATE"]);

describe("submit (REQ-005..018)", () => {
  it("correct guess solves", () => {
    const a = initAttempt(p2, "2024-04-01");
    const out = submit(a, p2, 0, "later", d2);
    expect(out.correct).toBe(true);
    expect(out.state.solved[0]).toBe(true);
  });
  it("not in dictionary consumes attempt", () => {
    const a = initAttempt(p2, "2024-04-01");
    const out = submit(a, p2, 0, "zzzz", d2);
    expect(out.error).toBe("not_in_dictionary");
    expect(out.state.attemptsRemaining).toBe(5);
  });
  it("encoding mismatch: real word but clue not an encoding of it", () => {
    const a = initAttempt(p2, "2024-04-01");
    const out = submit(a, p2, 0, "grate", d2); // GRATE encodes GR8, not L8R
    expect(out.error).toBe("encoding_mismatch");
  });
  it("empty consumes no attempt", () => {
    const a = initAttempt(p2, "2024-04-01");
    expect(submit(a, p2, 0, "  ", d2).error).toBe("empty_guess");
    expect(submit(a, p2, 0, "  ", d2).state.attemptsRemaining).toBe(6);
  });
  it("wins when all solved", () => {
    let a = initAttempt(p2, "2024-04-01");
    p2.answers.forEach((w, i) => { a = submit(a, p2, i, w, d2).state; });
    expect(a.status).toBe("won");
  });
  it("loses after 6 wrong", () => {
    let a = initAttempt(p2, "2024-04-01");
    for (let i = 0; i < 6; i++) a = submit(a, p2, 0, "zzzz", d2).state;
    expect(a.status).toBe("lost");
    expect(canSubmit(a)).toBe(false);
  });
  it("is pure", () => {
    const a = initAttempt(p2, "2024-04-01");
    submit(a, p2, 0, "later", d2);
    expect(a.solved[0]).toBe(false);
  });
});

describe("hint (REQ-019)", () => {
  it("reveals answer length", () => {
    const a = initAttempt(p2, "2024-04-01");
    const h = applyHint(a, p2, 0)!;
    expect(h.revealedLengths[0]).toBe("LATER".length);
  });
});

describe("share", () => {
  it("spoiler-safe", () => {
    const a = initAttempt(p2, "2024-04-01");
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Numeronym 2024-04-01");
    expect(isSpoilerSafe(text, p2)).toBe(true);
    expect(isSpoilerSafe("clue L8R here", p2)).toBe(false);
    expect(isSpoilerSafe("answer LATER", p2)).toBe(false);
  });
});
