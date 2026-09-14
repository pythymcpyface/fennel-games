import { describe, it, expect } from "vitest";
import {
  normalize,
  initAttempt,
  submitAnswer,
  canSubmit,
  totalFor,
  computeVerdict,
  advanceTick,
  isBarLit,
  lookupAnswer,
  repairState,
  selectDailyPuzzleId,
  selectPracticePuzzleId,
} from "../src/games/lowball/engine.ts";
import { MAX_PANEL_SCORE, SWEEPS_TOTAL, type Puzzle } from "../src/games/lowball/types.ts";

// Flagship category, scores mirroring the real generated pack.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  rule: { kind: "suffix", value: "ugh" },
  categoryLabel: 'Words ending in "ugh"',
  parValue: 21,
  categoryDomain: "words",
  answers: [
    { word: "though", panelScore: 100, isFindable: true },
    { word: "tough", panelScore: 81, isFindable: true },
    { word: "rough", panelScore: 43, isFindable: true },
    { word: "laugh", panelScore: 33, isFindable: true },
    { word: "cough", panelScore: 15, isFindable: true },
    { word: "trough", panelScore: 12, isFindable: true },
    { word: "bough", panelScore: 1, isFindable: true },
    { word: "hiccough", panelScore: 0, isFindable: true },
    { word: "usquebaugh", panelScore: 0, isFindable: false },
  ],
};

const fresh = (mode: "daily" | "practice" = "daily") => initAttempt(puzzle, "2026-09-10", mode);

/** Submit a sequence of answers, returning the final state. */
function play(...words: string[]) {
  let st = fresh();
  for (const word of words) st = submitAnswer(st, puzzle, word).state;
  return st;
}

describe("normalize — REQ-005", () => {
  it("TEST-008: trims, lowercases and strips non-letters", () => {
    expect(normalize("  ThOuGh  ")).toBe("though");
  });
  it("TEST-009: is idempotent", () => {
    const once = normalize("  ThOuGh  ");
    expect(normalize(once)).toBe(once);
  });
  it("strips digits and punctuation", () => {
    expect(normalize("t-o-u-g-h!")).toBe("tough");
  });
  it("normalises accented input to plain letters", () => {
    expect(normalize("thóugh")).toBe("though");
  });
  it("yields an empty string for whitespace or digits only", () => {
    expect(normalize("   ")).toBe("");
    expect(normalize("123")).toBe("");
  });
});

describe("lookupAnswer", () => {
  it("finds a listed answer", () => {
    expect(lookupAnswer(puzzle, "hiccough")?.panelScore).toBe(0);
  });
  it("returns null for an unlisted word", () => {
    expect(lookupAnswer(puzzle, "zzzzqqq")).toBeNull();
  });
});

describe("submitAnswer — scoring, REQ-006..010", () => {
  it("TEST-018: a valid answer takes its precomputed score", () => {
    const out = submitAnswer(fresh(), puzzle, "hiccough");
    expect(out.sweep?.panelScore).toBe(0);
    expect(out.sweep?.invalidReason).toBeNull();
  });

  it("TEST-019: an obvious answer takes the maximum score", () => {
    expect(submitAnswer(fresh(), puzzle, "though").sweep?.panelScore).toBe(100);
  });

  it("TEST-010: a word absent from the Answer List scores the penalty", () => {
    // Fits the "ugh" suffix so it reaches the Answer List check rather than being
    // short-circuited by the affix rule.
    const out = submitAnswer(fresh(), puzzle, "zzzzugh");
    expect(out.sweep?.panelScore).toBe(MAX_PANEL_SCORE);
    expect(out.sweep?.invalidReason).toBe("not_in_list");
  });

  it("TEST-011: an unlisted submission returns state without throwing", () => {
    expect(() => submitAnswer(fresh(), puzzle, "zzzzugh")).not.toThrow();
    expect(submitAnswer(fresh(), puzzle, "zzzzugh").state).toBeDefined();
  });

  it("TEST-012: a real word failing the suffix scores the penalty", () => {
    const out = submitAnswer(fresh(), puzzle, "table");
    expect(out.sweep?.panelScore).toBe(MAX_PANEL_SCORE);
    expect(out.sweep?.invalidReason).toBe("affix_mismatch");
  });

  it("TEST-013: a prefix category rejects a non-matching word", () => {
    const prefixPuzzle: Puzzle = {
      ...puzzle,
      rule: { kind: "prefix", value: "pre" },
      answers: [{ word: "prevent", panelScore: 40, isFindable: true }],
    };
    const out = submitAnswer(initAttempt(prefixPuzzle, "d"), prefixPuzzle, "postpone");
    expect(out.sweep?.invalidReason).toBe("affix_mismatch");
  });

  it("TEST-014/015: repeating the first answer scores the penalty and flags duplication", () => {
    const st = submitAnswer(fresh(), puzzle, "though").state;
    const out = submitAnswer(st, puzzle, "THOUGH  ");
    expect(out.sweep?.panelScore).toBe(MAX_PANEL_SCORE);
    expect(out.sweep?.isDuplicateOfEarlierAnswer).toBe(true);
    expect(out.sweep?.invalidReason).toBe("duplicate");
  });

  it("TEST-016/017: an empty or digits-only submission scores the penalty", () => {
    expect(submitAnswer(fresh(), puzzle, "   ").sweep?.panelScore).toBe(MAX_PANEL_SCORE);
    expect(submitAnswer(fresh(), puzzle, "123").sweep?.invalidReason).toBe("empty");
  });

  it("scores each sweep independently rather than carrying the first score forward", () => {
    const st = play("though", "hiccough");
    expect(st.players[0].sweeps.map((s) => s.panelScore)).toEqual([100, 0]);
  });
});

describe("submitAnswer — sweep advance, REQ-011, REQ-012", () => {
  it("TEST-020: a valid submission advances sweepIndex", () => {
    expect(submitAnswer(fresh(), puzzle, "though").state.sweepIndex).toBe(1);
  });
  it("TEST-021: an invalid submission also advances sweepIndex", () => {
    expect(submitAnswer(fresh(), puzzle, "zzzzqqq").state.sweepIndex).toBe(1);
  });
  it("TEST-022/023: a third submission is refused, leaving state untouched", () => {
    const done = play("though", "tough");
    expect(done.sweepIndex).toBe(SWEEPS_TOTAL);
    const out = submitAnswer(done, puzzle, "rough");
    expect(out.error).toBe("no_sweeps_remaining");
    expect(out.sweep).toBeNull();
    expect(out.state).toEqual(done);
  });
  it("canSubmit closes once both sweeps are consumed", () => {
    expect(canSubmit(fresh())).toBe(true);
    expect(canSubmit(play("though"))).toBe(true);
    expect(canSubmit(play("though", "tough"))).toBe(false);
  });
});

describe("totalFor + verdict — REQ-013..017", () => {
  it("TEST-024: the total is the sum of both sweeps", () => {
    expect(totalFor(play("trough", "bough").players[0])).toBe(13);
  });
  it("TEST-025: two zero-scoring answers total zero", () => {
    const p: Puzzle = {
      ...puzzle,
      answers: [
        { word: "hiccough", panelScore: 0, isFindable: true },
        { word: "sough", panelScore: 0, isFindable: true },
      ],
    };
    let st = initAttempt(p, "d");
    st = submitAnswer(st, p, "hiccough").state;
    st = submitAnswer(st, p, "sough").state;
    expect(totalFor(st.players[0])).toBe(0);
  });
  it("TEST-026/027: the total is not clamped at 100", () => {
    expect(totalFor(play("though", "tough").players[0])).toBe(181);
    expect(totalFor(play("zzzzqqq", "wwwwqqq").players[0])).toBe(200);
  });
  it("TEST-028: a total strictly below par wins", () => {
    const st = play("trough", "bough"); // 12 + 1 = 13 < par 21
    expect(st.verdict).toBe("win");
  });
  it("TEST-029: a total exactly equal to par loses", () => {
    expect(computeVerdict(21, 21)).toBe("loss");
  });
  it("TEST-030: a total above par loses", () => {
    expect(play("though", "tough").verdict).toBe("loss");
  });
  it("TEST-031: the verdict stays pending mid-round", () => {
    expect(play("trough").verdict).toBe("pending");
  });
  it("computeVerdict holds pending only via the round, not the comparison", () => {
    expect(computeVerdict(0, 21)).toBe("win");
    expect(computeVerdict(20, 21)).toBe("win");
    expect(computeVerdict(22, 21)).toBe("loss");
  });
});

describe("advanceTick — REQ-018..021", () => {
  it("TEST-032: the counter seeds at 100 on score assignment", () => {
    const st = submitAnswer(fresh(), puzzle, "laugh").state;
    expect(st.tickCounter).toBe(100);
    expect(st.tickTarget).toBe(33);
  });

  it("TEST-033: one advance decrements by exactly one", () => {
    let st = submitAnswer(fresh(), puzzle, "though").state; // target 100
    expect(st.tickCounter).toBe(100);
    st = submitAnswer(st, puzzle, "tough").state; // target 81
    expect(st.tickCounter).toBe(100);
    st = advanceTick(st);
    expect(st.tickCounter).toBe(99);
  });

  it("TEST-034: repeated advances drain to the target and stop", () => {
    let st = submitAnswer(fresh(), puzzle, "hiccough").state; // target 0
    for (let i = 0; i < 100; i++) st = advanceTick(st);
    expect(st.tickCounter).toBe(0);
  });

  it("TEST-035: advancing at the target is idempotent", () => {
    let st = submitAnswer(fresh(), puzzle, "hiccough").state;
    for (let i = 0; i < 100; i++) st = advanceTick(st);
    for (let i = 0; i < 20; i++) st = advanceTick(st);
    expect(st.tickCounter).toBe(0);
  });

  it("never drains below the target", () => {
    let st = submitAnswer(fresh(), puzzle, "laugh").state; // target 33
    for (let i = 0; i < 200; i++) st = advanceTick(st);
    expect(st.tickCounter).toBe(33);
  });

  it("TEST-036: reduced motion sets the counter straight to the target", () => {
    const st = submitAnswer(fresh(), puzzle, "laugh", { reducedMotion: true }).state;
    expect(st.tickCounter).toBe(33);
  });

  it("TEST-037: reduced motion never exposes the 100 start value", () => {
    const st = submitAnswer(fresh(), puzzle, "laugh", { reducedMotion: true }).state;
    expect(st.tickCounter).not.toBe(100);
  });

  it("advanceTick is a no-op before any sweep", () => {
    const st = fresh();
    expect(advanceTick(st)).toEqual(st);
  });
});

describe("isBarLit — counter drains downwards from the top", () => {
  const lit = (tick: number) => Array.from({ length: MAX_PANEL_SCORE }, (_, i) => isBarLit(i, tick));

  it("a full counter lights every bar", () => {
    expect(lit(MAX_PANEL_SCORE).every(Boolean)).toBe(true);
  });

  it("an empty counter lights no bar", () => {
    expect(lit(0).some(Boolean)).toBe(false);
  });

  it("empties from the TOP, so remaining bars sit at the bottom", () => {
    // index 0 is the topmost bar. At 99 of 100 the top bar must be the one that went out.
    expect(isBarLit(0, 99)).toBe(false);
    expect(isBarLit(99, 99)).toBe(true);
  });

  it("keeps exactly tickCounter bars lit at every value", () => {
    for (const tick of [0, 1, 13, 50, 87, 99, 100]) {
      expect(lit(tick).filter(Boolean)).toHaveLength(tick);
    }
  });

  it("lights one unbroken run ending at the bottom", () => {
    const bars = lit(40);
    const firstLit = bars.indexOf(true);
    expect(firstLit).toBe(MAX_PANEL_SCORE - 40);
    // no gaps: everything from the first lit bar to the last is lit
    expect(bars.slice(firstLit).every(Boolean)).toBe(true);
    expect(bars.slice(0, firstLit).some(Boolean)).toBe(false);
  });

  it("only ever turns bars off as the counter falls, never back on", () => {
    for (let tick = MAX_PANEL_SCORE; tick > 0; tick--) {
      const now = lit(tick);
      const next = lit(tick - 1);
      for (let i = 0; i < MAX_PANEL_SCORE; i++) {
        if (!now[i]) expect(next[i]).toBe(false);
      }
    }
  });
});

describe("purity — REQ-056", () => {
  it("TEST-096: the same transition twice yields deep-equal states", () => {
    const start = fresh();
    const a = submitAnswer(start, puzzle, "laugh").state;
    const b = submitAnswer(start, puzzle, "laugh").state;
    expect(a).toEqual(b);
  });

  it("does not mutate the input state", () => {
    const start = fresh();
    const snapshot = structuredClone(start);
    submitAnswer(start, puzzle, "though");
    expect(start).toEqual(snapshot);
  });
});

describe("selection — REQ-001..004, REQ-024, REQ-025", () => {
  it("TEST-001: the same seed yields the same puzzle id", () => {
    const a = selectDailyPuzzleId("2026-09-10", "1.0.0", "wordkit.en-GB.v1", 120);
    const b = selectDailyPuzzleId("2026-09-10", "1.0.0", "wordkit.en-GB.v1", 120);
    expect(a).toBe(b);
  });

  it("TEST-003: re-deriving on the same day cannot reassign the category", () => {
    const ids = new Set(
      Array.from({ length: 5 }, () => selectDailyPuzzleId("2026-09-10", "1.0.0", "d", 120)),
    );
    expect(ids.size).toBe(1);
  });

  it("TEST-006: every day over ten years maps into the admitted set", () => {
    const count = 120;
    for (let i = 0; i < 3650; i++) {
      const day = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
      const id = selectDailyPuzzleId(day, "1.0.0", "d", count);
      const idx = Number((id ?? "").slice(4));
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(count);
    }
  });

  it("TEST-007: a zero-category pack yields null rather than throwing", () => {
    expect(selectDailyPuzzleId("2026-09-10", "1.0.0", "d", 0)).toBeNull();
  });

  it("TEST-041: practice selection is deterministic for a given ordinal", () => {
    const a = selectPracticePuzzleId("2026-09-10", 3, 120, "puz-0005");
    const b = selectPracticePuzzleId("2026-09-10", 3, 120, "puz-0005");
    expect(a).toBe(b);
  });

  it("TEST-042: practice ordinals all map into the admitted set", () => {
    for (let ordinal = 1; ordinal <= 20; ordinal++) {
      const id = selectPracticePuzzleId("2026-09-10", ordinal, 120, "puz-0005");
      expect(id).not.toBeNull();
      const idx = Number((id ?? "").slice(4));
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(120);
    }
  });

  it("TEST-043: practice never returns today's daily category", () => {
    for (let ordinal = 1; ordinal <= 200; ordinal++) {
      const daily = selectDailyPuzzleId("2026-09-10", "1.0.0", "d", 30);
      const id = selectPracticePuzzleId("2026-09-10", ordinal, 30, daily);
      expect(id).not.toBe(daily);
    }
  });

  it("TEST-044: with a single admitted category practice returns the daily one", () => {
    expect(selectPracticePuzzleId("2026-09-10", 1, 1, "puz-0000")).toBe("puz-0000");
  });
});

describe("repairState — REQ-028, REQ-058", () => {
  it("TEST-098: a players array with three entries repairs to one", () => {
    const tampered = {
      ...fresh(),
      players: [
        { playerId: 0, sweeps: [] },
        { playerId: 1, sweeps: [] },
        { playerId: 2, sweeps: [] },
      ],
    };
    expect(repairState(tampered)?.players).toHaveLength(1);
  });

  it("TEST-047: malformed input repairs to null rather than throwing", () => {
    expect(repairState("not an object")).toBeNull();
    expect(repairState(null)).toBeNull();
    expect(repairState({})).toBeNull();
  });

  it("keeps a well-formed state intact", () => {
    const st = play("though");
    expect(repairState(structuredClone(st))).toEqual(st);
  });

  it("clamps an out-of-range sweepIndex", () => {
    const bad = { ...fresh(), sweepIndex: 99 };
    expect(repairState(bad)?.sweepIndex).toBeLessThanOrEqual(SWEEPS_TOTAL);
  });

  it("clamps a sweeps array longer than the round allows", () => {
    // A tampered save with three sweeps would otherwise leave sweeps.length above
    // sweepIndex, handing the player an extra turn.
    const sweep = {
      answerWord: "bough",
      panelScore: 1,
      invalidReason: null,
      isDuplicateOfEarlierAnswer: false,
    };
    const many = {
      ...fresh(),
      players: [{ playerId: 0, sweeps: [sweep, sweep, sweep] }],
      sweepIndex: 3,
    };
    const repaired = repairState(many);
    expect(repaired?.players[0].sweeps).toHaveLength(SWEEPS_TOTAL);
    expect(repaired?.sweepIndex).toBe(SWEEPS_TOTAL);
  });

  it("keeps sweepIndex consistent with the surviving sweeps", () => {
    const one = play("bough");
    const lying = { ...structuredClone(one), sweepIndex: 2 };
    const repaired = repairState(lying);
    expect(repaired?.sweepIndex).toBe(repaired?.players[0].sweeps.length);
  });

  it("refuses a terminal verdict claimed with too few sweeps", () => {
    // Otherwise a tampered save could claim a win having given no answers.
    const bogus = { ...fresh(), verdict: "win" };
    expect(repairState(bogus)?.verdict).toBe("pending");
    const oneSweep = { ...structuredClone(play("bough")), verdict: "win" };
    expect(repairState(oneSweep)?.verdict).toBe("pending");
  });

  it("preserves a terminal verdict backed by both sweeps", () => {
    const done = play("trough", "bough");
    expect(done.verdict).toBe("win");
    expect(repairState(structuredClone(done))?.verdict).toBe("win");
  });

  it("clamps an out-of-range tickCounter", () => {
    expect(repairState({ ...fresh(), tickCounter: 5000 })?.tickCounter).toBeLessThanOrEqual(100);
    expect(repairState({ ...fresh(), tickCounter: -20 })?.tickCounter).toBeGreaterThanOrEqual(0);
  });
});

describe("initAttempt", () => {
  it("starts pending with no sweeps and one player", () => {
    const st = fresh();
    expect(st.verdict).toBe("pending");
    expect(st.sweepIndex).toBe(0);
    expect(st.players).toHaveLength(1);
    expect(st.players[0].sweeps).toEqual([]);
    expect(st.tickTarget).toBeNull();
  });
  it("records the mode it was created for", () => {
    expect(fresh("practice").mode).toBe("practice");
    expect(fresh("daily").mode).toBe("daily");
  });
});
