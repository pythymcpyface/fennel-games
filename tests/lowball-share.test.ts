import { describe, it, expect } from "vitest";
import { buildShareText, isSpoilerSafe, scoreBar, canShare } from "../src/games/lowball/share.ts";
import { initAttempt, submitAnswer } from "../src/games/lowball/engine.ts";
import { PANEL_DISCLOSURE, FORBIDDEN_SURVEY_PHRASES } from "../src/games/lowball/types.ts";
import type { Puzzle } from "../src/games/lowball/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  rule: { kind: "suffix", value: "ugh" },
  categoryLabel: 'Words ending in "ugh"',
  parValue: 21,
  categoryDomain: "words",
  answers: [
    { word: "though", panelScore: 100, isFindable: true },
    { word: "tough", panelScore: 81, isFindable: true },
    { word: "trough", panelScore: 12, isFindable: true },
    { word: "bough", panelScore: 1, isFindable: true },
    { word: "hiccough", panelScore: 0, isFindable: true },
    { word: "usquebaugh", panelScore: 0, isFindable: false },
  ],
};

function playRound(mode: "daily" | "practice", ...words: string[]) {
  let st = initAttempt(puzzle, "2026-09-10", mode);
  for (const word of words) st = submitAnswer(st, puzzle, word).state;
  return st;
}

describe("scoreBar", () => {
  it("renders a bar proportional to the score", () => {
    expect(scoreBar(0)).not.toBe(scoreBar(100));
    expect(scoreBar(0).length).toBeGreaterThan(0);
  });
  it("clamps out-of-range input", () => {
    expect(() => scoreBar(-50)).not.toThrow();
    expect(() => scoreBar(500)).not.toThrow();
  });
  it("gives a lower score a shorter filled run", () => {
    const filledOf = (s: string) => [...s].filter((c) => c === "🟥").length;
    expect(filledOf(scoreBar(10))).toBeLessThan(filledOf(scoreBar(90)));
  });
});

describe("canShare — REQ-057", () => {
  it("TEST-097: sharing is closed while the verdict is pending", () => {
    expect(canShare(playRound("daily"))).toBe(false);
    expect(canShare(playRound("daily", "trough"))).toBe(false);
  });
  it("opens once the round is terminal", () => {
    expect(canShare(playRound("daily", "trough", "bough"))).toBe(true);
  });
});

describe("buildShareText — REQ-047, REQ-048", () => {
  it("TEST-080: contains neither submitted answer word", () => {
    const st = playRound("daily", "though", "tough");
    const text = buildShareText(st, puzzle.parValue);
    expect(text.toLowerCase()).not.toContain("though");
    expect(text.toLowerCase()).not.toContain("tough");
  });

  it("TEST-081: contains no answer from the Answer List at all", () => {
    const st = playRound("daily", "trough", "bough");
    const text = buildShareText(st, puzzle.parValue);
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    for (const a of puzzle.answers) {
      expect(text.toLowerCase()).not.toContain(a.word.toLowerCase());
    }
  });

  it("TEST-083: a daily share omits the practice marker", () => {
    const text = buildShareText(playRound("daily", "trough", "bough"), puzzle.parValue);
    expect(text).not.toContain("(Practice)");
  });

  it("TEST-082: a practice share carries the practice marker", () => {
    const text = buildShareText(playRound("practice", "trough", "bough"), puzzle.parValue);
    expect(text).toContain("(Practice)");
  });

  it("reports the total and par", () => {
    const text = buildShareText(playRound("daily", "trough", "bough"), puzzle.parValue);
    expect(text).toContain("13"); // 12 + 1
    expect(text).toContain("21"); // par
  });

  it("names the game and the day", () => {
    const text = buildShareText(playRound("daily", "trough", "bough"), puzzle.parValue);
    expect(text).toContain("Lowball");
    expect(text).toContain("2026-09-10");
  });

  it("uses the supplied game title instead of the 'Lowball' default", () => {
    const text = buildShareText(
      playRound("daily", "trough", "bough"),
      puzzle.parValue,
      "Lowball: Countries",
    );
    expect(text).toContain("Lowball: Countries");
    expect(text).not.toMatch(/^Lowball /); // not the bare word-mode title
  });

  it("distinguishes a win from a loss", () => {
    const won = buildShareText(playRound("daily", "trough", "bough"), puzzle.parValue);
    const lost = buildShareText(playRound("daily", "though", "tough"), puzzle.parValue);
    expect(won).not.toBe(lost);
  });

  it("does not leak the practice marker into the spoiler check", () => {
    const st = playRound("practice", "trough", "bough");
    expect(isSpoilerSafe(buildShareText(st, puzzle.parValue), puzzle)).toBe(true);
  });

  it("stays spoiler-safe even when every sweep was invalid", () => {
    const st = playRound("daily", "table", "   ");
    const text = buildShareText(st, puzzle.parValue);
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(text).toContain("200");
  });
});

describe("isSpoilerSafe", () => {
  it("catches an answer word leaking in any casing", () => {
    expect(isSpoilerSafe("Lowball 2026-09-10 HICCOUGH", puzzle)).toBe(false);
    expect(isSpoilerSafe("Lowball 2026-09-10 hiccough", puzzle)).toBe(false);
  });
  it("passes text with no answer words", () => {
    expect(isSpoilerSafe("Lowball 2026-09-10 13/21", puzzle)).toBe(true);
  });
});

describe("panel-score honesty — REQ-053", () => {
  it("TEST-089: the disclosure states the panel is simulated and names its source", () => {
    expect(PANEL_DISCLOSURE).toContain("simulated panel of 100");
    expect(PANEL_DISCLOSURE).toContain("corpus frequency");
  });

  it("TEST-090: the disclosure implies no survey of real people", () => {
    const lower = PANEL_DISCLOSURE.toLowerCase();
    for (const phrase of FORBIDDEN_SURVEY_PHRASES) {
      expect(lower).not.toContain(phrase);
    }
  });

  it("the disclosure never claims the data is ground truth", () => {
    const lower = PANEL_DISCLOSURE.toLowerCase();
    expect(lower).not.toContain("ground truth");
    expect(lower).not.toContain("real people");
    expect(lower).not.toContain("actual");
  });

  it("share text carries no wording implying a real survey", () => {
    // The share text travels outside the app, where the on-screen disclosure cannot
    // follow it, so it must not make a panel claim of any kind.
    const text = buildShareText(playRound("daily", "trough", "bough"), puzzle.parValue).toLowerCase();
    for (const phrase of FORBIDDEN_SURVEY_PHRASES) {
      expect(text).not.toContain(phrase);
    }
    expect(text).not.toContain("people");
  });
});
