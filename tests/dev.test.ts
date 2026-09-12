import { describe, it, expect } from "vitest";
import { isDevMode, readDevOverride, devOverrideKey, resolveDailyPuzzleIndex } from "../src/kit/dev.ts";
import { derivePuzzleId } from "../src/kit/selection.ts";

function reader(store: Record<string, string>, search = ""): { read: (k: string) => string | null; locationSearch: string } {
  return { read: (k) => store[k] ?? null, locationSearch: search };
}

describe("isDevMode", () => {
  it("is on with ?dev=1 in the URL", () => {
    expect(isDevMode(reader({}, "http://x/#/game/foo?dev=1"))).toBe(true);
  });
  it("is on with a persisted flag", () => {
    expect(isDevMode(reader({ "fennel-games:v1:dev:enabled": "1" }))).toBe(true);
  });
  it("is off by default", () => {
    expect(isDevMode(reader({}, "http://x/#/game/foo"))).toBe(false);
  });
});

describe("readDevOverride", () => {
  it("returns null when dev mode is off, even if a value is stored", () => {
    const store = { [devOverrideKey("web-hub")]: "5" };
    expect(readDevOverride("web-hub", reader(store, ""))).toBeNull();
  });
  it("reads the URL override scoped to the game id", () => {
    const r = reader({}, "http://x/#/game/web-hub?dev=1&puzzle=web-hub:hello");
    expect(readDevOverride("web-hub", r)).toBe("hello");
    expect(readDevOverride("tier-list", r)).toBeNull();
  });
  it("falls back to the per-game storage key", () => {
    const store = { "fennel-games:v1:dev:enabled": "1", [devOverrideKey("tier-list")]: "12" };
    expect(readDevOverride("tier-list", reader(store))).toBe("12");
  });
});

describe("resolveDailyPuzzleIndex", () => {
  const args = ["2026-01-01", "1.0.0", "ds", 100] as const;
  const normal = Number(derivePuzzleId("2026-01-01", "1.0.0", "ds", 100).slice(4));

  it("returns the normal daily index when no override", () => {
    expect(resolveDailyPuzzleIndex("g", ...args, reader({}))).toBe(normal);
  });

  it("honours a numeric override in range (dev on)", () => {
    const store = { "fennel-games:v1:dev:enabled": "1", [devOverrideKey("g")]: "42" };
    expect(resolveDailyPuzzleIndex("g", ...args, reader(store))).toBe(42);
  });

  it("ignores an out-of-range numeric override", () => {
    const store = { "fennel-games:v1:dev:enabled": "1", [devOverrideKey("g")]: "999" };
    expect(resolveDailyPuzzleIndex("g", ...args, reader(store))).toBe(normal);
  });

  it("resolves a word override via resolveByWord", () => {
    const store = { "fennel-games:v1:dev:enabled": "1", [devOverrideKey("g")]: "ocean" };
    const idx = resolveDailyPuzzleIndex("g", ...args, reader(store), (w) => (w === "ocean" ? 7 : -1));
    expect(idx).toBe(7);
  });

  it("falls back to normal when a word override is not found", () => {
    const store = { "fennel-games:v1:dev:enabled": "1", [devOverrideKey("g")]: "zzz" };
    const idx = resolveDailyPuzzleIndex("g", ...args, reader(store), () => -1);
    expect(idx).toBe(normal);
  });

  it("ignores overrides entirely when dev mode is off", () => {
    const store = { [devOverrideKey("g")]: "42" };
    expect(resolveDailyPuzzleIndex("g", ...args, reader(store))).toBe(normal);
  });
});
