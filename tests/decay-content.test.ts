import { describe, it, expect } from "vitest";
import { validate, buildPuzzle, assertPuzzleValid, type RawPuzzle } from "../src/games/decay/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/decay/share.ts";
import { initAttempt, submit } from "../src/games/decay/engine.ts";

const dict = new Set(["cat", "dog", "bird", "fish"]);

function raw(): RawPuzzle {
  return {
    targets: [
      { word: "cat", decayOrder: [0, 1, 2] },
      { word: "dog", decayOrder: [2, 1, 0] },
    ],
    lockThreshold: 2,
  };
}

describe("decay content-build — fairness gate", () => {
  it("accepts valid targets with valid decay orders", () => {
    expect(validate(raw(), dict)).toEqual([]);
    const p = buildPuzzle("puz-0000", raw(), dict)!;
    expect(p).not.toBeNull();
    expect(p.targets).toHaveLength(2);
    expect(() => assertPuzzleValid(raw(), dict)).not.toThrow();
  });

  it("rejects an empty target list (REQ-022)", () => {
    expect(validate({ targets: [], lockThreshold: 1 }, dict)).toContain("puzzle has no targets");
  });

  it("rejects a non-dictionary word (REQ-023)", () => {
    const r = raw();
    r.targets[0] = { word: "xyz", decayOrder: [0, 1, 2] };
    expect(validate(r, dict).some((x) => x.includes("not in dictionary"))).toBe(true);
  });

  it("rejects duplicate targets (REQ-024)", () => {
    const r = raw();
    r.targets[1] = { word: "cat", decayOrder: [0, 1, 2] };
    expect(validate(r, dict).some((x) => x.includes("duplicate"))).toBe(true);
  });

  it("rejects an invalid decay order permutation (REQ-025)", () => {
    const bad = { ...raw() };
    bad.targets = [{ word: "cat", decayOrder: [0, 0, 2] }, bad.targets[1]];
    expect(validate(bad, dict).some((x) => x.includes("invalid decay order"))).toBe(true);
    const oob = { ...raw() };
    oob.targets = [{ word: "cat", decayOrder: [0, 1, 5] }, oob.targets[1]];
    expect(validate(oob, dict).some((x) => x.includes("invalid decay order"))).toBe(true);
  });

  it("rejects an out-of-range lock threshold", () => {
    const r = raw();
    r.lockThreshold = 5;
    expect(validate(r, dict).some((x) => x.includes("lockThreshold"))).toBe(true);
  });
});

describe("decay share — spoiler safety", () => {
  it("emits a per-word outcome grid + lock count without words", () => {
    const p = buildPuzzle("puz-0000", raw(), dict)!;
    let s = initAttempt(p, "2026-01-01");
    s = submit(s, p, "cat").state;
    s = submit(s, p, "dog").state;
    const text = buildShareText(s, p, "2026-01-01");
    expect(text).toContain("Decay 2026-01-01 2/2");
    expect(text).toContain("🟩");
    expect(isSpoilerSafe(text, p)).toBe(true);
    expect(text.toUpperCase()).not.toContain("CAT");
    expect(text.toUpperCase()).not.toContain("DOG");
  });

  it("isSpoilerSafe flags text containing a target word", () => {
    const p = buildPuzzle("puz-0000", raw(), dict)!;
    expect(isSpoilerSafe("Decay CAT", p)).toBe(false);
  });
});
