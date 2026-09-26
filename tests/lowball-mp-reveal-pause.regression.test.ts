// Regression tests for bug: lowball-mp-reveal-pause
//
// BUG: on mobile the reveal drain + paused countdown never played, the
// end-of-sweep review was skipped (relay auto-advanced after 5s), and the
// score-100 ✕ / score-0 celebration were wiped by an immediate re-render.
//
// Root cause: the client only deferred re-renders while a setInterval was
// running. prefers-reduced-motion (default-on for many phones) and score 100
// set no interval, and the deferral fired the instant the drain ended.
//
// REQ-FIX-001..005 — see .bob/notes/lowball-mp-reveal-pause/BUG-SPECIFICATION.md
// These drive the REAL plugin (not a harness) through its event handler.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { GameServices } from "../src/kit/types.ts";
import type { ClientEvent } from "../src/games/lowball/multiplayer-client.ts";
import { lowballPlugin, lowballCountriesPlugin } from "../src/games/lowball/plugin.ts";
import { MP_RESULT_HOLD_MS, MP_REVEAL_TICK_MS, revealDurationMs } from "../src/games/lowball/mp-types.ts";

function makeServices(): GameServices {
  const store: Record<string, string> = {};
  return {
    storage: { read: (k) => store[k] ?? null, write: (k, v) => { store[k] = v; }, remove: (k) => { delete store[k]; } },
    clock: { nowMs: () => Date.now() },
    share: { share: async () => ({ ok: true, method: "clipboard" as const }) },
    assets: {
      loadText: async () => JSON.stringify({
        contentPackVersion: "1", datasetId: "test", puzzleCount: 1,
        puzzles: [{
          puzzleId: "puz-0000", rule: { kind: "suffix", value: "ugh" },
          categoryLabel: 'Words ending in "ugh"', parValue: 21,
          answers: [{ word: "tough", panelScore: 81, isFindable: true }, { word: "slough", panelScore: 0, isFindable: true }],
        }],
      }),
    },
    roomCode: "ABC123",
    keyFor: (suffix) => `fennel-games:v1:lowball:${suffix}`,
    onResult: () => {},
    goHome: () => {},
  } as GameServices;
}

type Internals = { handleMpEvent(e: ClientEvent): void };

function setReducedMotion(on: boolean): void {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes("reduce"), media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

async function startRound(plugin = lowballPlugin): Promise<{ root: HTMLElement; send: (e: ClientEvent) => void }> {
  const root = document.createElement("div");
  document.body.append(root);
  const game = (await plugin.mount(root, makeServices())) as unknown as Internals;
  const send = (e: ClientEvent) => game.handleMpEvent(e);
  send({ kind: "joined", slotIndex: 0, isHost: true, displayName: "Alice" });
  send({ kind: "player-list", players: [
    { slotIndex: 0, displayName: "Alice", isHost: true },
    { slotIndex: 1, displayName: "Bob", isHost: false },
  ], count: 2 });
  send({ kind: "start", categoryLabel: 'Words ending in "ugh"', parValue: 21, rule: { kind: "suffix", value: "ugh" } } as ClientEvent);
  send({ kind: "sweep-start", sweepIndex: 0, deadlineTs: Date.now() + 30_000, activeSlot: 0 });
  return { root, send };
}

const reveal = (slot: number, score: number, word = "tough"): ClientEvent => ({
  kind: "reveal", slotIndex: slot, displayName: slot === 0 ? "Alice" : "Bob", word,
  score, verdict: score === 100 ? "INVALID" : "VALID", runningTotal: score,
});

const num = (root: HTMLElement) => root.querySelector(".lb-score-num")?.textContent;
const countdown = (root: HTMLElement) => root.querySelector(".lb-mp-countdown")?.textContent;

describe("lowball MP reveal pause — REQ-FIX-001/002", () => {
  beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = ""; setReducedMotion(false); });
  afterEach(() => { vi.useRealTimers(); });

  it("REG-001: drain plays and the next turn waits for drain + hold, even with reduced motion (mobile)", async () => {
    setReducedMotion(true);
    const { root, send } = await startRound();
    send(reveal(0, 40));
    send({ kind: "sweep-start", sweepIndex: 0, deadlineTs: Date.now() + 30_000 + revealDurationMs(40), activeSlot: 1 });
    expect(num(root)).toBe("100");
    vi.advanceTimersByTime(30 * MP_REVEAL_TICK_MS);
    expect(num(root)).toBe("70"); // animating, not jumped
    const frozen = countdown(root);
    vi.advanceTimersByTime(30 * MP_REVEAL_TICK_MS);
    expect(num(root)).toBe("40");
    expect(countdown(root)).toBe(frozen); // countdown paused during reveal
    expect(root.textContent).not.toContain("Answer locked in"); // next-turn view not yet built
    vi.advanceTimersByTime(MP_RESULT_HOLD_MS);
    expect(root.textContent).toContain("Answer locked in"); // queued sweep-start applied
    expect(countdown(root)).toBe("30s"); // fresh full turn after the reveal
  });

  it("REG-002: score 100 shows a big ✕ and still holds before the next turn", async () => {
    const { root, send } = await startRound();
    send(reveal(0, 100, "zzz"));
    send({ kind: "sweep-start", sweepIndex: 0, deadlineTs: Date.now() + 32_000, activeSlot: 1 });
    expect(root.querySelector(".lb-result-cross")).not.toBeNull();
    vi.advanceTimersByTime(MP_RESULT_HOLD_MS - 10);
    expect(root.querySelector(".lb-result-cross")).not.toBeNull();
    vi.advanceTimersByTime(20);
    expect(root.querySelector(".lb-result-cross")).toBeNull(); // next turn rendered
  });

  it("REG-003: score 0 shows the celebration and it survives the hold", async () => {
    const { root, send } = await startRound(lowballCountriesPlugin);
    send(reveal(0, 0, "slough"));
    send({ kind: "sweep-start", sweepIndex: 0, deadlineTs: Date.now() + 40_000, activeSlot: 1 });
    vi.advanceTimersByTime(100 * MP_REVEAL_TICK_MS);
    expect(root.querySelector(".lb-result-tick")?.textContent).toContain("Pointless!");
    expect(root.querySelector(".confetti-host")).not.toBeNull();
    vi.advanceTimersByTime(MP_RESULT_HOLD_MS / 2);
    expect(root.querySelector(".lb-result-tick")).not.toBeNull();
  });

  it("REG-004: events queued behind a reveal survive a second reveal and apply in order", async () => {
    const { root, send } = await startRound();
    send(reveal(0, 90));
    send({ kind: "sweep-start", sweepIndex: 0, deadlineTs: Date.now() + 60_000, activeSlot: 1 });
    send(reveal(1, 80, "rough"));
    send({ kind: "between-sweeps", nextSweepIndex: 1, deadlineTs: 0, canAdvance: true });
    vi.advanceTimersByTime(revealDurationMs(90));
    // first reveal done → sweep-start applied → second reveal now draining
    expect(num(root)).toBe("100");
    vi.advanceTimersByTime(revealDurationMs(80));
    expect(root.textContent).toContain("Sweep complete");
    expect(root.querySelector("button")?.textContent).toBeDefined();
    expect([...root.querySelectorAll("button")].some((b) => b.textContent === "Next sweep")).toBe(true);
  });

  it("REG-005: between-sweeps holds indefinitely with no countdown until the host acts", async () => {
    const { root, send } = await startRound();
    send(reveal(1, 60, "rough"));
    send({ kind: "between-sweeps", nextSweepIndex: 1, deadlineTs: 0, canAdvance: true });
    vi.advanceTimersByTime(revealDurationMs(60));
    expect(root.textContent).toContain("Sweep complete");
    vi.advanceTimersByTime(60_000);
    expect(root.textContent).toContain("Sweep complete");
    expect(countdown(root)).toBe("—");
  });

  it("REG-006: the final reveal plays before the leaderboard replaces it", async () => {
    const { root, send } = await startRound();
    send(reveal(1, 50, "rough"));
    send({ kind: "leaderboard", board: [] });
    expect(root.textContent).not.toContain("Final Scores");
    vi.advanceTimersByTime(revealDurationMs(50));
    expect(root.textContent).toContain("Final Scores");
  });

  it("REG-007: countdown display is capped at 30s when the deadline includes reveal grace", async () => {
    const { root, send } = await startRound();
    send({ kind: "sweep-start", sweepIndex: 0, deadlineTs: Date.now() + 37_000, activeSlot: 1 });
    expect(countdown(root)).toBe("30s");
  });
});

describe("revealDurationMs", () => {
  it("is drain time plus hold", () => {
    expect(revealDurationMs(100)).toBe(MP_RESULT_HOLD_MS);
    expect(revealDurationMs(0)).toBe(100 * MP_REVEAL_TICK_MS + MP_RESULT_HOLD_MS);
    expect(revealDurationMs(150)).toBe(MP_RESULT_HOLD_MS);
  });
});

describe("single-player score effects — REQ-FIX-005", () => {
  beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = ""; setReducedMotion(false); });
  afterEach(() => { vi.useRealTimers(); });

  async function solo(plugin = lowballPlugin): Promise<HTMLElement> {
    const root = document.createElement("div");
    document.body.append(root);
    const svc = { ...makeServices(), roomCode: undefined } as GameServices;
    await plugin.mount(root, svc);
    return root;
  }
  function submit(root: HTMLElement, word: string): void {
    const input = root.querySelector("#lb-answer") as HTMLInputElement;
    input.value = word;
    (root.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { cancelable: true }));
  }

  it("REG-SP-001: a 100 (not in list) shows the big ✕ after the drain", async () => {
    const root = await solo();
    submit(root, "zzzugh");
    vi.advanceTimersByTime(2000);
    expect(root.querySelector(".lb-result-cross")).not.toBeNull();
  });

  it("REG-SP-002: a pointless 0 celebrates (countries variant too)", async () => {
    const root = await solo(lowballCountriesPlugin);
    submit(root, "slough");
    vi.advanceTimersByTime(3000);
    expect(root.querySelector(".lb-result-tick")?.textContent).toContain("Pointless!");
  });

  it("REG-SP-003: a mid score shows neither effect", async () => {
    const root = await solo();
    submit(root, "tough");
    vi.advanceTimersByTime(3000);
    expect(root.querySelector(".lb-result-overlay")).toBeNull();
  });
});
