import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isBlockedWord, isSafeAffix, groupWordsByAffix } from "../src/games/lowball/content-build.ts";
import { matchesRule } from "../src/games/lowball/types.ts";
import type { Puzzle } from "../src/games/lowball/types.ts";

// Regression suite for bug `lowball-valid-answer-rejected`.
//
// Reported: the category `Words ending in "ape"` rejected "grape" as invalid and
// applied the 100-point penalty. Two independent generator defects caused it:
//
//   Cause A — the profanity blocklist matched as an unanchored substring, so /rape/
//             destroyed grape, drape, scrape, crape, serape, undrape, broomrape,
//             and /cock/ destroyed peacock and shuttlecock.
//   Cause B — the generator grouped words with `length > affix.length + 1` while the
//             runtime accepts `length > affix.length`, silently dropping every word
//             exactly one letter longer than its affix (cape, tape, came, name...).
//
// Measured before the fix: 75 of 120 categories affected, 184 valid words rejected.

const pack = JSON.parse(readFileSync("public/lowball.json", "utf8")) as {
  contentPackVersion: string;
  puzzleCount: number;
  puzzles: Puzzle[];
};

describe("cause A — blocklist must not match as a substring (REQ-001)", () => {
  // TEST-001, TEST-002, TEST-003
  const collateral = [
    "grape", "drape", "scrape", "crape", "serape", "undrape", "broomrape",
    "peacock", "shuttlecock",
  ];

  it.each(collateral)("treats %s as a clean word", (word) => {
    expect(isBlockedWord(word)).toBe(false);
  });

  it("does not block innocent words that merely contain blocked letters", () => {
    for (const word of ["classic", "spectacles", "assassin", "cockatoo", "scunthorpe"]) {
      expect(isBlockedWord(word)).toBe(false);
    }
  });
});

describe("cause A — genuine profanity is still excluded (REQ-002)", () => {
  // TEST-004: the standalone term itself must stay blocked.
  it("blocks the standalone offensive term", () => {
    expect(isBlockedWord("rape")).toBe(true);
    expect(isBlockedWord("shit")).toBe(true);
    expect(isBlockedWord("cunt")).toBe(true);
  });

  // TEST-005: inflected forms must stay blocked, or the fix would be worse than the bug.
  it("blocks simple inflections of a blocked term", () => {
    for (const word of ["rapes", "raped", "raping", "raper", "rapers"]) {
      expect(isBlockedWord(word)).toBe(true);
    }
    expect(isBlockedWord("shits")).toBe(true);
    expect(isBlockedWord("cocks")).toBe(true);
  });

  // TEST-006: enumerated offensive compounds must stay blocked even though
  // whole-word matching alone would admit them.
  it("blocks enumerated offensive compounds", () => {
    expect(isBlockedWord("rapeseed")).toBe(true);
    expect(isBlockedWord("bullshit")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBlockedWord("RAPE")).toBe(true);
    expect(isBlockedWord("Grape")).toBe(false);
  });
});

describe("cause A — category prompts stay clean (REQ-003)", () => {
  // TEST-007: an affix that IS a blocked term must never become a prompt.
  it("rejects an affix that is itself a blocked term", () => {
    expect(isSafeAffix("rape")).toBe(false);
    expect(isSafeAffix("shit")).toBe(false);
  });

  // The inverse of the bug: "ape" must NOT be rejected merely because "rape"
  // contains it. This exact mistake was made once while prototyping the fix.
  it("accepts an affix that is only a substring of a blocked term", () => {
    expect(isSafeAffix("ape")).toBe(true);
    expect(isSafeAffix("ock")).toBe(true);
  });

  // TEST-008
  it("ships no category prompt containing a blocked term", () => {
    for (const p of pack.puzzles) {
      const rule = p.rule as { kind: "prefix" | "suffix"; value: string };
      expect(isSafeAffix(rule.value)).toBe(true);
      expect(isBlockedWord(rule.value)).toBe(false);
    }
  });
});

describe("cause B — build-time grouping equals the runtime rule (REQ-004)", () => {
  // TEST-009, TEST-010, TEST-011
  it("groups a word one letter longer than its affix", () => {
    const grouped = groupWordsByAffix(["cape", "tape", "gape", "nape", "jape", "vape"]);
    const ape = grouped.get("suffix:ape") ?? [];
    expect(ape).toEqual(expect.arrayContaining(["cape", "tape", "gape", "nape", "jape", "vape"]));
  });

  it("groups four-letter words under a three-letter suffix", () => {
    const grouped = groupWordsByAffix(["came", "dame", "fame", "game", "lame", "name", "same", "tame"]);
    expect(grouped.get("suffix:ame") ?? []).toHaveLength(8);
  });

  it("groups five-letter words under a four-letter suffix", () => {
    const grouped = groupWordsByAffix(["bough", "cough", "dough", "rough", "tough"]);
    expect(grouped.get("suffix:ough") ?? []).toHaveLength(5);
  });

  it("never groups a word equal in length to its affix", () => {
    const grouped = groupWordsByAffix(["ape"]);
    expect(grouped.get("suffix:ape")).toBeUndefined();
  });

  it("agrees with matchesRule for every grouping it produces", () => {
    const grouped = groupWordsByAffix(["cape", "grape", "escape", "landscape", "came", "bough"]);
    for (const [key, words] of grouped) {
      const [type, value] = key.split(":") as ["suffix" | "prefix", string];
      for (const w of words) {
        expect(matchesRule(w, { kind: type, value })).toBe(true);
      }
    }
  });
});

describe("the reported case (REQ-008)", () => {
  const ape = pack.puzzles.find(
    (p) => p.rule.kind === "suffix" && (p.rule as { value: string }).value === "ape",
  );

  it("ships the 'ape' category", () => {
    expect(ape).toBeDefined();
  });

  // The exact defect the player hit.
  it("includes grape with a real panel score, not the penalty", () => {
    const grape = ape?.answers.find((a) => a.word === "grape");
    expect(grape).toBeDefined();
    expect(grape?.panelScore).toBeLessThan(100);
  });

  it("includes the other blocklist-collateral words for this category", () => {
    const words = new Set(ape?.answers.map((a) => a.word));
    for (const w of ["grape", "drape", "scrape", "crape", "serape", "undrape", "broomrape"]) {
      expect(words).toContain(w);
    }
  });

  it("includes the off-by-one words for this category", () => {
    const words = new Set(ape?.answers.map((a) => a.word));
    for (const w of ["cape", "tape", "gape", "nape", "jape", "vape"]) {
      expect(words).toContain(w);
    }
  });
});

describe("soundness — no shipped answer violates the runtime rule (REQ-006)", () => {
  // TEST-014: every answer the pack ships must be one the engine would accept.
  it("every answer in every category satisfies matchesRule", () => {
    const violations: string[] = [];
    for (const p of pack.puzzles) {
      for (const a of p.answers) {
        if (!matchesRule(a.word, p.rule)) {
          violations.push(`${p.puzzleId} ${JSON.stringify(p.rule)} -> ${a.word}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("ships no blocked word as an answer", () => {
    const leaked: string[] = [];
    for (const p of pack.puzzles) {
      for (const a of p.answers) {
        if (isBlockedWord(a.word)) leaked.push(`${p.puzzleId} -> ${a.word}`);
      }
    }
    expect(leaked).toEqual([]);
  });
});
