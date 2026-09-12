import { describe, it, expect } from "vitest";
import { validate, buildPuzzle, assertPuzzleValid, type RawPuzzle } from "../src/games/cascade-type/content-build.ts";
import { buildShareText, isSpoilerSafe, scoreBand, comboBand } from "../src/games/cascade-type/share.ts";
import { initAttempt, submit } from "../src/games/cascade-type/engine.ts";

const dict = new Set(["cat", "dog", "ark", "toe", "act", "ate"]);

function raw(): RawPuzzle {
  return { rows: [["cat", "dog"], ["ark", "toe"]] };
}

describe("cascade-type content-build — fairness gate", () => {
  it("accepts a valid cascade", () => {
    expect(validate(raw(), dict)).toEqual([]);
    const p = buildPuzzle("puz-0000", raw(), dict)!;
    expect(p).not.toBeNull();
    expect(p.rows).toHaveLength(2);
    expect(() => assertPuzzleValid(raw(), dict)).not.toThrow();
  });

  it("rejects no rows (REQ-027)", () => {
    expect(validate({ rows: [] }, dict)).toContain("puzzle has no rows");
  });

  it("rejects an empty row (REQ-028)", () => {
    const r = raw();
    r.rows[1] = [];
    expect(validate(r, dict).some((x) => x.includes("is empty"))).toBe(true);
  });

  it("rejects a non-dictionary word (REQ-029)", () => {
    const r = raw();
    r.rows[0] = ["xyz", "dog"];
    expect(validate(r, dict).some((x) => x.includes("not in dictionary"))).toBe(true);
  });

  it("rejects a duplicate word across the cascade (REQ-030)", () => {
    const r = raw();
    r.rows[1] = ["cat", "toe"]; // cat appears twice
    expect(validate(r, dict).some((x) => x.includes("duplicate"))).toBe(true);
  });
});

describe("cascade-type share — bands & spoiler safety", () => {
  it("scoreBand and comboBand map thresholds", () => {
    expect(scoreBand(0)).toBe("D");
    expect(scoreBand(85)).toBe("S");
    expect(comboBand(0)).toBe("D");
    expect(comboBand(9)).toBe("S");
  });

  it("emits bands + progress bar with no words", () => {
    const p = buildPuzzle("puz-0000", raw(), dict)!;
    let s = initAttempt(p, "2026-01-01");
    for (const row of p.rows) for (const w of row) s = submit(s, p, w).state;
    const text = buildShareText(s, p, "2026-01-01");
    expect(text).toContain("Cascade Type 2026-01-01");
    expect(text).toContain("🟩");
    expect(isSpoilerSafe(text, p)).toBe(true);
    for (const row of p.rows) for (const w of row) expect(text.toUpperCase()).not.toContain(w.toUpperCase());
  });

  it("isSpoilerSafe flags a leaked word", () => {
    const p = buildPuzzle("puz-0000", raw(), dict)!;
    expect(isSpoilerSafe("Cascade Type CAT", p)).toBe(false);
  });
});
