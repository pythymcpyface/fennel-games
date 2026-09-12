import { describe, it, expect } from "vitest";
import { buildPuzzles, assertPuzzlesValid, DAILY_DEFS } from "../src/games/affix-loom/content-build.ts";
import { assembleSurfaceForm, normalizeToken } from "../src/games/affix-loom/engine.ts";

describe("affix-loom content-build", () => {
  const puzzles = buildPuzzles();

  it("builds one puzzle per daily def with stable ids", () => {
    expect(puzzles).toHaveLength(DAILY_DEFS.length);
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(puzzles[2].puzzleId).toBe("puz-0002");
  });

  it("every target reconstructs from its own decomposition", () => {
    for (const p of puzzles) {
      const spec = p.target_specs[0];
      const rebuilt = assembleSurfaceForm(p, {
        base_id: spec.base_id,
        prefix_ids: spec.prefix_ids,
        suffix_ids: spec.suffix_ids,
      });
      expect(rebuilt).not.toBeNull();
      expect(normalizeToken(rebuilt as string)).toBe(spec.surface);
    }
  });

  it("produces the expected en-GB target surfaces (regression: reusable)", () => {
    const surfaces = puzzles.map((p) => p.target_specs[0].surface);
    expect(surfaces).toContain("reusable");
    expect(surfaces).toContain("running");
    expect(surfaces).not.toContain("rusable");
  });

  it("fairness gate passes when the lexicon contains the targets", () => {
    const lex = new Set(puzzles.map((p) => p.target_specs[0].surface));
    expect(() => assertPuzzlesValid(puzzles, lex)).not.toThrow();
  });

  it("fairness gate throws when a target is missing from the lexicon", () => {
    expect(() => assertPuzzlesValid(puzzles, new Set())).toThrow();
  });
});
