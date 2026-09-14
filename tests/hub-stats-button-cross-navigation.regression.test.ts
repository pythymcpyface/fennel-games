// Regression test for bug: hub-stats-button-cross-navigation
//
// BUG: navigating directly from one game to another via hash-only routing
// (e.g. "#/game/lowball-countries" -> "#/game/lowball", which Hub.route()
// sends straight to openGame() without an intervening showHub()) left the
// OUTGOING game's retention MutationObserver attached. Its inject() closure
// still carried the old game's `gameName`/`statsKey`. That stale observer's
// mutation callback fired against the newly-mounted game's `.game-bar` before
// the new attachRetention() call ran, planting a Stats button labelled for
// the WRONG game — and wired to open the wrong game's stats modal — because
// the new attachRetention() then saw `!bar.querySelector(".stats-btn")` fail
// and skipped adding its own button.
//
// Root cause: Hub.openGame() never disconnected the previous juiceObserver /
// retentionObserver (unlike Hub.showHub(), which does before rendering the hub
// screen). Fix: openGame() now disconnects both before mounting the new plugin.
//
// REQ-FIX-001 / TEST-001: the Stats button after game→game hash nav bears the
//   NEW game's aria-label, not the previous game's.
// REQ-FIX-002 / TEST-002: only one .stats-btn exists after the navigation (no
//   duplicate/orphaned button from the stale observer).
// REQ-FIX-003 / TEST-003: the same holds navigating in the opposite direction.

import { describe, it, expect, beforeEach } from "vitest";
import { Hub } from "../src/hub/hub.ts";
import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../src/kit/types.ts";
import type { PlatformAdapter } from "../src/kit/ports.ts";

function makeAdapter(): PlatformAdapter {
  const store: Record<string, string> = {};
  return {
    storage: {
      read: (k) => store[k] ?? null,
      write: (k, v) => { store[k] = v; },
      remove: (k) => { delete store[k]; },
    },
    clock: { nowMs: () => new Date("2026-09-14T00:00:00Z").getTime() },
    share: { share: async () => ({ ok: true, method: "clipboard" as const }) },
    assets: { loadText: async () => "{}" },
  };
}

/** A minimal plugin that renders a `.game-bar` div, mimicking every real game plugin. */
function makeStubPlugin(id: string, name: string): GamePlugin {
  return {
    meta: { id, name, tagline: "", glyph: "x", accent: "#000" },
    contentPackPath: "./none.json",
    async mount(root: HTMLElement, _services: GameServices): Promise<GameInstance> {
      root.innerHTML = "";
      const bar = document.createElement("div");
      bar.className = "game-bar";
      const title = document.createElement("h1");
      title.className = "game-title";
      title.textContent = name;
      bar.append(title);
      root.append(bar);
      const result: DailyResult = { gameId: id, dayId: "2026-09-14", played: false, solved: false };
      return {
        render() {},
        currentResult: () => result,
      };
    },
  };
}

describe("Hub — stats button after direct game→game hash navigation (regression)", () => {
  let root: HTMLElement;
  let hub: Hub;
  const pluginA = makeStubPlugin("game-a", "Game A");
  const pluginB = makeStubPlugin("game-b", "Game B");

  beforeEach(() => {
    root = document.createElement("div");
    document.body.innerHTML = "";
    document.body.append(root);
    window.location.hash = "";
    hub = new Hub(makeAdapter(), [pluginA, pluginB], root);
    hub.start();
  });

  it("TEST-001: Stats button carries the NEW game's aria-label after A -> B nav", async () => {
    window.location.hash = "#/game/game-a";
    window.dispatchEvent(new Event("hashchange"));
    await Promise.resolve();
    await Promise.resolve();

    window.location.hash = "#/game/game-b";
    window.dispatchEvent(new Event("hashchange"));
    await Promise.resolve();
    await Promise.resolve();

    const btn = root.querySelector(".stats-btn");
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("aria-label")).toBe("Game B statistics");
  });

  it("TEST-002: exactly one .stats-btn exists after the navigation (no stale duplicate)", async () => {
    window.location.hash = "#/game/game-a";
    window.dispatchEvent(new Event("hashchange"));
    await Promise.resolve();
    await Promise.resolve();

    window.location.hash = "#/game/game-b";
    window.dispatchEvent(new Event("hashchange"));
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelectorAll(".stats-btn").length).toBe(1);
  });

  it("TEST-003: holds in the reverse direction (B -> A)", async () => {
    window.location.hash = "#/game/game-b";
    window.dispatchEvent(new Event("hashchange"));
    await Promise.resolve();
    await Promise.resolve();

    window.location.hash = "#/game/game-a";
    window.dispatchEvent(new Event("hashchange"));
    await Promise.resolve();
    await Promise.resolve();

    const btn = root.querySelector(".stats-btn");
    expect(btn?.getAttribute("aria-label")).toBe("Game A statistics");
    expect(root.querySelectorAll(".stats-btn").length).toBe(1);
  });
});
