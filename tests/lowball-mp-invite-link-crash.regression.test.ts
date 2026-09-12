// Regression tests for bug: mp-invite-link-crash
//
// BUG: TypeError: Cannot read properties of undefined (reading 'sweepIndex')
//   at currentResult() (plugin.ts:232)
//   at openGame() (hub.ts:90)
//
// Root cause: currentResult() unconditionally accesses this.state.sweepIndex
// and this.state.verdict, but this.state is never initialised on the multiplayer
// join path (startMpJoin is called instead of startDaily).
//
// REQ-FIX-001 / TEST-001: currentResult returns safely when this.state is undefined
// REQ-FIX-002 / TEST-002: returned object has played:false, solved:false (no crash)
// REQ-FIX-003 / TEST-003: single-player path still works after guard added
// REQ-FIX-004 / TEST-004: boundary — room code present but state set later (simulate)

import { describe, it, expect } from "vitest";
import type { GameServices } from "../src/kit/types.ts";
import type { StoragePort, ClockPort, SharePort, AssetPort } from "../src/kit/ports.ts";

// ---------------------------------------------------------------------------
// Minimal stub services — enough to call init() and currentResult()
// ---------------------------------------------------------------------------

function makeServices(roomCode?: string): GameServices {
  const store: Record<string, string> = {};
  const storage: StoragePort = {
    read: (k) => store[k] ?? null,
    write: (k, v) => { store[k] = v; },
    remove: (k) => { delete store[k]; },
  };
  const clock: ClockPort = { nowMs: () => new Date("2026-09-12T00:00:00Z").getTime() };
  const share: SharePort = { share: async () => ({ ok: true, method: "clipboard" as const }) };
  const assets: AssetPort = {
    loadText: async () => JSON.stringify({
      contentPackVersion: "1",
      datasetId: "test",
      puzzleCount: 1,
      puzzles: [{
        puzzleId: "puz-0000",
        affixType: "suffix",
        affixValue: "ugh",
        categoryLabel: 'Words ending in "ugh"',
        parValue: 21,
        answers: [{ word: "tough", panelScore: 81, isFindable: true }],
      }],
    }),
  };
  return {
    storage,
    clock,
    share,
    assets,
    roomCode,
    keyFor: (suffix) => `fennel-games:v1:lowball:${suffix}`,
    onResult: () => {},
    goHome: () => {},
  };
}

// ---------------------------------------------------------------------------
// Import the Lowball plugin mount function
// ---------------------------------------------------------------------------

import { lowballPlugin } from "../src/games/lowball/plugin.ts";

// ---------------------------------------------------------------------------
// REQ-FIX-001 / TEST-001: currentResult must not throw when opened via invite link
// ---------------------------------------------------------------------------

describe("currentResult — invite link (multiplayer join path) — REQ-FIX-001", () => {
  it("TEST-001: does not throw when this.state is undefined (room code present)", async () => {
    const root = document.createElement("div");
    const svc = makeServices("ABC123"); // invite link has room code
    const game = await lowballPlugin.mount(root, svc);

    // This is the exact call that crashed in production (hub.ts:90)
    expect(() => game.currentResult()).not.toThrow();
  });

  it("TEST-002: returns played:false and solved:false on the multiplayer join path", async () => {
    const root = document.createElement("div");
    const svc = makeServices("ABC123");
    const game = await lowballPlugin.mount(root, svc);

    const result = game.currentResult();
    expect(result.played).toBe(false);
    expect(result.solved).toBe(false);
    expect(result.gameId).toBe("lowball");
  });

  it("TEST-003: single-player path still returns correct played/solved after guard added", async () => {
    const root = document.createElement("div");
    const svc = makeServices(); // no room code → single-player
    const game = await lowballPlugin.mount(root, svc);

    // Single-player init: this.state IS set, no words played yet
    const result = game.currentResult();
    expect(result.played).toBe(false); // sweepIndex === 0, not > 0
    expect(result.solved).toBe(false);
    expect(result.gameId).toBe("lowball");
  });

  it("TEST-004: currentResult returns a defined object in all cases (never undefined)", async () => {
    const root = document.createElement("div");

    // With room code (MP path)
    const mpGame = await lowballPlugin.mount(root, makeServices("XYZ789"));
    expect(mpGame.currentResult()).toBeDefined();

    // Without room code (SP path)
    const spGame = await lowballPlugin.mount(root, makeServices());
    expect(spGame.currentResult()).toBeDefined();
  });
});
