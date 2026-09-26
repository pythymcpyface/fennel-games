// Regression (lowball-mp-reveal-pause, relay side):
// REQ-FIX-003: after sweep 1 the room holds on review until the host sends "next".
// REQ-FIX-004: each turn's deadline is pushed back by the previous reveal's length.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// room.ts is typed against @cloudflare/workers-types, which the app tsconfig does
// not load; import it untyped via a runtime path so vitest runs it but tsc does not
// pull the Worker globals into the web app's typecheck.
const ROOM_MODULE = "../workers/lowball-relay/src/room.ts";
type RelayCtor = new (state: unknown) => unknown;
const { LowballRelayDO } = (await import(/* @vite-ignore */ ROOM_MODULE)) as { LowballRelayDO: RelayCtor };
import { MP_TURN_MS, revealDurationMs } from "../src/games/lowball/mp-types.ts";
import type { RoomState } from "../src/games/lowball/mp-types.ts";

function harness() {
  const sent: Array<Record<string, unknown>> = [];
  const store = new Map<string, unknown>();
  let alarm: number | null = null;
  const sockets = [0, 1].map((slotIndex) => ({
    send: (m: string) => sent.push({ to: slotIndex, ...JSON.parse(m) }),
    deserializeAttachment: () => ({ slotIndex }),
  }));
  const state = {
    storage: {
      get: async (k: string) => store.get(k),
      put: async (k: string, v: unknown) => { store.set(k, v); },
      delete: async (k: string) => { store.delete(k); },
      setAlarm: async (t: number) => { alarm = t; },
      deleteAlarm: async () => { alarm = null; },
    },
    getWebSockets: () => sockets,
  };
  const room = new LowballRelayDO(state);
  const player = (slotIndex: number) => ({
    slotIndex, displayName: slotIndex === 0 ? "Alice" : "Bob", isHost: slotIndex === 0,
    sweeps: [], tiebreakSweeps: [], usedWords: new Set<string>(), isConnected: true,
  });
  const r = room as unknown as {
    roomState: RoomState; loaded: boolean;
    webSocketMessage(ws: unknown, m: string): Promise<void>;
    alarm(): Promise<void>;
  };
  r.loaded = true;
  r.roomState = {
    roomCode: "ABC123", gameId: "lowball", players: [player(0), player(1)], phase: "lobby",
    sweepIndex: 0, tiebreakRoundNumber: 0, tiedPlayerSlots: [], puzzleId: null, activePlayerSlot: -1,
  };
  const msg = (slot: number, m: object) => r.webSocketMessage(sockets[slot], JSON.stringify(m));
  return { r, sent, msg, alarm: () => alarm };
}

describe("relay host-gated next sweep", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-26T12:00:00Z")); });
  afterEach(() => vi.useRealTimers());

  it("REG-RELAY-001: sweep 2 never auto-starts; only the host's next starts it", async () => {
    const h = harness();
    await h.msg(0, { type: "start" });
    await h.msg(0, { type: "submit", word: "tough" });
    await h.msg(1, { type: "submit", word: "zzz" });
    await vi.runAllTimersAsync();
    expect(h.r.roomState.phase).toBe("between-sweeps");
    expect(h.alarm()).toBeNull(); // no auto-advance alarm
    await h.r.alarm(); // even a stray alarm must not advance
    expect(h.r.roomState.phase).toBe("between-sweeps");
    await h.msg(1, { type: "next" }); // non-host ignored
    expect(h.r.roomState.phase).toBe("between-sweeps");
    await h.msg(0, { type: "next" });
    expect(h.r.roomState.phase).toBe("sweep");
    expect(h.r.roomState.sweepIndex).toBe(1);
  });

  it("REG-RELAY-002: next turn's deadline includes the previous reveal's animation", async () => {
    const h = harness();
    await h.msg(0, { type: "start" });
    await vi.runAllTimersAsync();
    const first = h.sent.filter((m) => m.type === "sweep-start").pop()!;
    expect(first.sweepDeadlineTimestamp).toBe(Date.now() + MP_TURN_MS);
    await h.msg(0, { type: "submit", word: "zzz" }); // invalid → 100
    await vi.runAllTimersAsync();
    const second = h.sent.filter((m) => m.type === "sweep-start").pop()!;
    expect(second.activeSlot).toBe(1);
    expect(second.sweepDeadlineTimestamp).toBe(Date.now() + MP_TURN_MS + revealDurationMs(100));
  });
});
