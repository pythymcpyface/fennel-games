import { describe, it, expect, beforeEach } from "vitest";
import { secondsUntilNextPuzzle, formatCountdown, openStatsModal } from "../src/kit/retention.ts";
import type { ClockPort, StoragePort } from "../src/kit/ports.ts";

describe("secondsUntilNextPuzzle (REQ-011, UTC rollover)", () => {
  it("computes seconds to next UTC midnight", () => {
    // 2024-04-01T00:00:00Z -> exactly 24h to next rollover
    const clock: ClockPort = { nowMs: () => Date.parse("2024-04-01T00:00:00Z") };
    expect(secondsUntilNextPuzzle(clock)).toBe(24 * 3600);
  });
  it("mid-day value", () => {
    const clock: ClockPort = { nowMs: () => Date.parse("2024-04-01T23:59:59Z") };
    expect(secondsUntilNextPuzzle(clock)).toBe(1);
  });
});

describe("formatCountdown", () => {
  it("formats H:MM:SS", () => {
    expect(formatCountdown(3661)).toBe("1:01:01");
    expect(formatCountdown(59)).toBe("0:00:59");
    expect(formatCountdown(0)).toBe("0:00:00");
  });
});

function memStorage(seed?: Record<string, string>): StoragePort {
  const m = new Map<string, string>(Object.entries(seed ?? {}));
  return { read: (k) => (m.has(k) ? m.get(k)! : null), write: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

describe("openStatsModal (REQ-009/010)", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("renders empty-state when no games played", () => {
    openStatsModal({ gameName: "Test", statsKey: "k", storage: memStorage() });
    expect(document.querySelector(".modal-empty")).not.toBeNull();
  });

  it("renders stat cells when stats exist and closes on button", () => {
    const stats = JSON.stringify({ schemaVersion: 1, played: 4, won: 3, currentStreak: 2, maxStreak: 5, playedDays: [], wonDays: [], lastWonDay: null });
    openStatsModal({ gameName: "Test", statsKey: "k", storage: memStorage({ k: stats }) });
    const values = Array.from(document.querySelectorAll(".stat-value")).map((n) => n.textContent);
    expect(values).toEqual(["4", "75", "2", "5"]); // played, win%, current, max
    (document.querySelector(".modal-close") as HTMLButtonElement).click();
    expect(document.querySelector(".modal-overlay")).toBeNull();
  });

  it("Escape closes the modal", () => {
    openStatsModal({ gameName: "Test", statsKey: "k", storage: memStorage() });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(".modal-overlay")).toBeNull();
  });
});
