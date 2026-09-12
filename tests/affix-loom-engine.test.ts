import { describe, it, expect } from "vitest";
import {
  normalizeToken,
  rollupReason,
  assembleSurfaceForm,
  validateAttempt,
  initAttempt,
  selectBase,
  togglePrefix,
  toggleSuffix,
  clearSelection,
  canSubmit,
  submit,
  MAX_ATTEMPTS,
} from "../src/games/affix-loom/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/affix-loom/share.ts";
import type { Puzzle } from "../src/games/affix-loom/types.ts";

// A compact puzzle: base "use", prefix "re", suffix "able"; target "reusable".
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  bases: [
    { id: "b_use", token: "use" },
    { id: "b_run", token: "run" },
  ],
  prefixes: [{ id: "p_re", token: "re", kind: "prefix" }],
  suffixes: [
    { id: "s_able", token: "able", kind: "suffix" },
    { id: "s_ing", token: "ing", kind: "suffix" },
  ],
  ortho_rules: [
    { base_id: "b_use", affix_id: "s_able", op: "silent_e_drop" },
    { base_id: "b_use", affix_id: "s_ing", op: "silent_e_drop" },
    { base_id: "b_run", affix_id: "s_ing", op: "consonant_double" },
  ],
  compatibility: { banned_combos: [{ base_id: "b_run", affix_id: "p_re" }], min_len: 3, max_len: 20 },
  slot_rules: { max_prefixes: 2, max_suffixes: 2, allow_repeat_affix: false },
  taboo_tokens: [],
  targets: ["reusable"],
  target_specs: [{ base_id: "b_use", prefix_ids: ["p_re"], suffix_ids: ["s_able"], surface: "reusable" }],
  clue: "Able to be used again.",
};

const lexicon = new Set(["reusable", "using", "run", "running", "used"]);

describe("normalizeToken", () => {
  it("casefolds, strips diacritics, drops whitespace", () => {
    expect(normalizeToken("RÉusáble ")).toBe("reusable");
  });
});

describe("assembleSurfaceForm ortho (regression: prefix e not dropped)", () => {
  it("re + use + able => reusable (not rusable)", () => {
    const s = assembleSurfaceForm(puzzle, { base_id: "b_use", prefix_ids: ["p_re"], suffix_ids: ["s_able"] });
    expect(s).toBe("reusable");
  });
  it("silent_e_drop applies at base->suffix boundary: use + ing => using", () => {
    expect(assembleSurfaceForm(puzzle, { base_id: "b_use", prefix_ids: [], suffix_ids: ["s_ing"] })).toBe("using");
  });
  it("consonant_double: run + ing => running", () => {
    expect(assembleSurfaceForm(puzzle, { base_id: "b_run", prefix_ids: [], suffix_ids: ["s_ing"] })).toBe("running");
  });
  it("returns null for an unknown base", () => {
    expect(assembleSurfaceForm(puzzle, { base_id: "nope", prefix_ids: [], suffix_ids: [] })).toBeNull();
  });
});

describe("rollupReason", () => {
  it("maps internal codes to player buckets", () => {
    expect(rollupReason("OK")).toBe("VALID");
    expect(rollupReason("LEXICON_MISS")).toBe("INVALID_WORD");
    expect(rollupReason("TARGET_MISMATCH")).toBe("NOT_TODAYS_ANSWER");
    expect(rollupReason("COMPATIBILITY_FAIL")).toBe("RULES_MISMATCH");
  });
});

describe("validateAttempt", () => {
  it("VALID when the build equals the target", () => {
    const r = validateAttempt(puzzle, { base_id: "b_use", prefix_ids: ["p_re"], suffix_ids: ["s_able"] }, lexicon);
    expect(r.reason_player).toBe("VALID");
    expect(r.canonical_surface_form).toBe("reusable");
  });
  it("COMPATIBILITY_FAIL (RULES_MISMATCH) for a banned combo", () => {
    const r = validateAttempt(puzzle, { base_id: "b_run", prefix_ids: ["p_re"], suffix_ids: ["s_ing"] }, lexicon);
    expect(r.reason_player).toBe("RULES_MISMATCH");
    expect(r.reason_internal).toBe("COMPATIBILITY_FAIL");
  });
  it("INVALID_WORD when the assembled form is not in the lexicon", () => {
    const r = validateAttempt(puzzle, { base_id: "b_run", prefix_ids: [], suffix_ids: ["s_able"] }, lexicon);
    expect(r.reason_player).toBe("INVALID_WORD");
  });
  it("NOT_TODAYS_ANSWER for a valid non-target word with grades", () => {
    const r = validateAttempt(puzzle, { base_id: "b_run", prefix_ids: [], suffix_ids: ["s_ing"] }, lexicon);
    expect(r.reason_player).toBe("NOT_TODAYS_ANSWER");
    expect(r.grades.length).toBeGreaterThan(0);
  });
  it("SLOT_ORDER_INVALID rolls up to RULES_MISMATCH when too many prefixes", () => {
    const r = validateAttempt(puzzle, { base_id: "b_use", prefix_ids: ["p_re", "p_re", "p_re"], suffix_ids: [] }, lexicon);
    expect(r.reason_player).toBe("RULES_MISMATCH");
  });
});

describe("attempt-state reducer", () => {
  it("selects base and toggles affixes", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = selectBase(s, "b_run");
    s = togglePrefix(s, "p_re");
    s = toggleSuffix(s, "s_ing");
    expect(s.selection).toEqual({ base_id: "b_run", prefix_ids: ["p_re"], suffix_ids: ["s_ing"] });
    s = togglePrefix(s, "p_re"); // toggle off
    expect(s.selection.prefix_ids).toEqual([]);
    expect(canSubmit(s)).toBe(true);
    s = clearSelection(s);
    expect(s.selection.base_id).toBeNull();
    expect(canSubmit(s)).toBe(false);
  });

  it("records attempts and fails after MAX_ATTEMPTS", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = selectBase(s, "b_run");
    s = toggleSuffix(s, "s_able"); // "runable" — not in lexicon => INVALID_WORD
    for (let i = 0; i < MAX_ATTEMPTS; i++) s = submit(s, puzzle, lexicon).state;
    expect(s.attemptsUsed).toBe(MAX_ATTEMPTS);
    expect(s.isFailed).toBe(true);
    expect(s.isSolved).toBe(false);
  });
});

describe("share", () => {
  it("is spoiler-safe (never contains the target)", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = { ...s, isSolved: true, attemptsUsed: 2 };
    const text = buildShareText(s, s.dayId);
    expect(text).toContain("Affix Loom");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
  });
  it("flags a payload that leaks the target token", () => {
    expect(isSpoilerSafe("Affix Loom reusable", puzzle)).toBe(false);
  });
});
