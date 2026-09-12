import { describe, it, expect } from "vitest";
import { canonicalizeDayId, derivePuzzleId, fnv1a32 } from "../src/kit/selection.ts";

// Phase 1 — deterministic selection. Sources: Test Plan selection_and_dayid.feature
// (@REQ-001 AC-TEST-001/002, @REQ-002 AC-TEST-003/004), NFR-002 cross-platform determinism.

describe("canonicalizeDayId (REQ-001)", () => {
  it("AC-TEST-001: derives canonical YYYY-MM-DD from a fixed timestamp under UTC rule", () => {
    // 1711929600000 = 2024-04-01T00:00:00Z
    expect(canonicalizeDayId(1711929600000, "UTC")).toBe("2024-04-01");
  });

  it("maps any instant within the UTC day to that day", () => {
    const endOfDay = 1711929600000 + 24 * 60 * 60 * 1000 - 1;
    expect(canonicalizeDayId(endOfDay, "UTC")).toBe("2024-04-01");
    expect(canonicalizeDayId(1711929600000 + 24 * 60 * 60 * 1000, "UTC")).toBe("2024-04-02");
  });

  it("AC-TEST-002: same timestamp yields identical dayId (platform-independent, pure)", () => {
    const ts = 1711929600000;
    const a = canonicalizeDayId(ts, "UTC");
    const b = canonicalizeDayId(ts, "UTC");
    expect(a).toBe(b);
    expect(a).toBe("2024-04-01");
  });

  it("throws on a non-finite clock value (REQ-001 error mode)", () => {
    expect(() => canonicalizeDayId(NaN, "UTC")).toThrow();
    expect(() => canonicalizeDayId(Infinity, "UTC")).toThrow();
  });
});

describe("fnv1a32 hash (TERM-018 seedable hash primitive)", () => {
  it("is deterministic for the same input", () => {
    expect(fnv1a32("2024-04-01|1.0.0|core.en.v1")).toBe(fnv1a32("2024-04-01|1.0.0|core.en.v1"));
  });

  it("produces a 32-bit unsigned integer", () => {
    const h = fnv1a32("hello");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("differs for different inputs", () => {
    expect(fnv1a32("a")).not.toBe(fnv1a32("b"));
  });
});

describe("derivePuzzleId (REQ-002)", () => {
  const packVersion = "1.0.0";
  const dictId = "core.en.v1";
  const puzzleCount = 365;

  it("AC-TEST-003: computes identical puzzleId for identical inputs (deterministic)", () => {
    const a = derivePuzzleId("2024-04-01", packVersion, dictId, puzzleCount);
    const b = derivePuzzleId("2024-04-01", packVersion, dictId, puzzleCount);
    expect(a).toBe(b);
  });

  it("puzzleId is a stable formatted token within [0, puzzleCount)", () => {
    const id = derivePuzzleId("2024-04-01", packVersion, dictId, puzzleCount);
    expect(id).toMatch(/^puz-\d{4}$/);
    const n = Number(id.slice(4));
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(puzzleCount);
  });

  it("AC-TEST-004: changing dayId changes the selected puzzle", () => {
    const a = derivePuzzleId("2024-04-01", packVersion, dictId, puzzleCount);
    const b = derivePuzzleId("2024-04-02", packVersion, dictId, puzzleCount);
    expect(a).not.toBe(b);
  });

  it("changing packVersion or dictionaryId changes the puzzle (archive freeze per version)", () => {
    const base = derivePuzzleId("2024-04-01", packVersion, dictId, puzzleCount);
    expect(derivePuzzleId("2024-04-01", "2.0.0", dictId, puzzleCount)).not.toBe(base);
    expect(derivePuzzleId("2024-04-01", packVersion, "core.en.v2", puzzleCount)).not.toBe(base);
  });
});
