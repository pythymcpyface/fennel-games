import { describe, it, expect } from "vitest";
import {
  buildEntry,
  buildPuzzle,
  assertPuzzleValid,
  shuffleCandidates,
  clueLeaksAnswer,
  normalizeAnswer,
  type RawEntry,
} from "../src/games/clueback/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/clueback/share.ts";
import { initAttempt, select } from "../src/games/clueback/engine.ts";

const raw: RawEntry = {
  entryId: "e0",
  answer: "ocean",
  correctClue: "Vast body of salt water",
  distractors: ["A small mountain stream", "A large freshwater lake"],
};

describe("clueback content-build — entry gate", () => {
  it("builds a fair entry with 3 distinct candidates and a valid correctIndex", () => {
    const e = buildEntry(raw)!;
    expect(e).not.toBeNull();
    expect(e.answer).toBe("OCEAN");
    expect(e.candidates).toHaveLength(3);
    expect(new Set(e.candidates).size).toBe(3);
    expect(e.correctIndex).toBeGreaterThanOrEqual(0);
    expect(e.correctIndex).toBeLessThan(3);
    expect(e.candidates[e.correctIndex]).toBe("Vast body of salt water");
  });

  it("rejects entries where two clues are identical", () => {
    const dup = { ...raw, distractors: ["Same", "Same"] as [string, string] };
    expect(buildEntry(dup)).toBeNull();
  });

  it("rejects a clue that leaks the answer word", () => {
    const leak = { ...raw, distractors: ["The OCEAN is deep", "A lake"] as [string, string] };
    expect(buildEntry(leak)).toBeNull();
  });

  it("rejects a non-letter answer", () => {
    const bad = { ...raw, answer: "12-3" };
    expect(buildEntry(bad)).toBeNull();
  });

  it("clueLeaksAnswer ignores whitespace and case", () => {
    expect(clueLeaksAnswer("the o c e a n", "OCEAN")).toBe(true);
    expect(clueLeaksAnswer("a body of water", "OCEAN")).toBe(false);
    expect(normalizeAnswer("  ocean ")).toBe("OCEAN");
  });
});

describe("clueback content-build — shuffle determinism", () => {
  it("is deterministic for a given seed and always places the correct clue", () => {
    const a = shuffleCandidates("C", ["D1", "D2"], "seed-x");
    const b = shuffleCandidates("C", ["D1", "D2"], "seed-x");
    expect(a).toEqual(b);
    expect(a.candidates[a.correctIndex]).toBe("C");
    expect(new Set(a.candidates)).toEqual(new Set(["C", "D1", "D2"]));
  });
});

describe("clueback content-build — puzzle gate", () => {
  const entries: RawEntry[] = [
    raw,
    { entryId: "e1", answer: "COMET", correctClue: "Icy tailed body", distractors: ["A planet ring", "A crater"] },
    { entryId: "e2", answer: "MAPLE", correctClue: "Syrup tree", distractors: ["A palm", "A shrub"] },
  ];

  it("builds a valid multi-entry puzzle and passes assertPuzzleValid", () => {
    const p = buildPuzzle("puz-0000", entries)!;
    expect(p).not.toBeNull();
    expect(p.entries).toHaveLength(3);
    expect(() => assertPuzzleValid(p)).not.toThrow();
  });

  it("rejects a puzzle with fewer than 3 entries", () => {
    expect(buildPuzzle("puz-0000", entries.slice(0, 2))).toBeNull();
  });

  it("rejects a puzzle with duplicate entry ids", () => {
    const dupIds = [entries[0], { ...entries[1], entryId: "e0" }, entries[2]];
    expect(buildPuzzle("puz-0000", dupIds)).toBeNull();
  });
});

describe("clueback share — spoiler safety", () => {
  const p = buildPuzzle("puz-0000", [
    raw,
    { entryId: "e1", answer: "COMET", correctClue: "Icy tailed body", distractors: ["A planet ring", "A crater"] },
    { entryId: "e2", answer: "MAPLE", correctClue: "Syrup tree", distractors: ["A palm", "A shrub"] },
  ])!;

  it("builds a grid of per-entry correctness without revealing answers", () => {
    let s = initAttempt(p, "2026-01-01");
    s = select(s, p, 0, p.entries[0].correctIndex).state;
    s = select(s, p, 1, p.entries[1].correctIndex).state;
    // deliberately wrong on e2:
    const wrong = (p.entries[2].correctIndex + 1) % 3;
    s = select(s, p, 2, wrong).state;

    const text = buildShareText(s, p, "2026-01-01");
    expect(text).toContain("Clueback 2026-01-01 2/3");
    expect(text).toContain("🟩");
    expect(text).toContain("⬛");
    expect(isSpoilerSafe(text, p)).toBe(true);
    // No answer appears in the share text.
    for (const e of p.entries) expect(text.toUpperCase()).not.toContain(e.answer);
  });

  it("isSpoilerSafe flags text that contains an answer", () => {
    expect(isSpoilerSafe("Clueback OCEAN", p)).toBe(false);
  });
});
