// Regression tests for mp-anim-timer bug fix.
//
// BUG: In multiplayer Lowball Countries, when a player submits an answer the
// server broadcasts `reveal` immediately followed by `sweep-start` for the
// next player. The sweep-start handler was calling stopMpTicking() before the
// 5-second reveal animation completed, meaning the animation never played.
// The timer reset was also imperceptible because the DOM was rebuilt at the
// same instant.
//
// FIX: The sweep-start handler now checks whether mpTickTimer is in flight.
// If so, it saves the DOM rebuild as onMpTickComplete and lets the animation
// run to its natural end. Only then does it call renderLiveRound() +
// startMpCountdown() with the fresh 30s deadline.
//
// These tests cover the pure logic extracted from that fix:
//   - onMpTickComplete fires when the tick interval reaches its target
//   - onMpTickComplete is cleared by stopMpTicking (force-stop path)
//   - A sweep-start arriving when no animation is in flight rebuilds immediately
//   - The deferred rebuild sees the updated mpState (correct deadlineTs)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Minimal harness — we test the callback mechanic in isolation rather than
// spinning up a full Lowball plugin instance (which requires Carbon web
// components, full DOM, and ContentPack loading).
// ---------------------------------------------------------------------------

/**
 * Miniature reimplementation of the tick-with-callback mechanic so we can
 * unit-test it without importing plugin.ts and its heavy DOM dependencies.
 * This mirrors the exact code paths changed in plugin.ts:
 *   - startMpTicking: the interval fires onComplete when it hits target
 *   - stopMpTicking:  clears onComplete (the safe-teardown path)
 */
class TickHarness {
  mpTickCounter = 0;
  mpTickTimer: ReturnType<typeof setInterval> | null = null;
  onMpTickComplete: (() => void) | null = null;

  stopMpTicking(): void {
    if (this.mpTickTimer !== null) {
      clearInterval(this.mpTickTimer);
      this.mpTickTimer = null;
    }
    this.onMpTickComplete = null;
  }

  startMpTicking(target: number, tickMs: number): void {
    this.stopMpTicking();
    this.mpTickCounter = 100; // MAX_PANEL_SCORE
    this.mpTickTimer = setInterval(() => {
      if (this.mpTickCounter <= target) {
        this.mpTickCounter = Math.max(this.mpTickCounter, target);
        const onComplete = this.onMpTickComplete;
        this.stopMpTicking();
        if (onComplete) onComplete();
        return;
      }
      this.mpTickCounter -= 1;
    }, tickMs);
  }
}

// ---------------------------------------------------------------------------

describe("mp-anim-timer regression — onMpTickComplete deferral", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("REG-001: onMpTickComplete fires when tick interval reaches target", () => {
    const h = new TickHarness();
    const completed = vi.fn();
    h.startMpTicking(20, 50);
    h.onMpTickComplete = completed;

    // Each tick decrements by 1; 100→20 = 80 ticks at 50ms each = 4000ms
    expect(completed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4100); // just past the 80th tick
    expect(completed).toHaveBeenCalledOnce();
  });

  it("REG-002: onMpTickComplete fires at the correct tick count (target reached)", () => {
    const h = new TickHarness();
    let capturedCounter = -1;
    h.startMpTicking(42, 50);
    h.onMpTickComplete = () => { capturedCounter = h.mpTickCounter; };

    vi.advanceTimersByTime(10_000);
    // counter should be clamped to target when callback fires
    expect(capturedCounter).toBe(42);
  });

  it("REG-003: stopMpTicking clears onMpTickComplete so it never fires after a force-stop", () => {
    const h = new TickHarness();
    const completed = vi.fn();
    h.startMpTicking(10, 50);
    h.onMpTickComplete = completed;

    // Interrupt partway through (simulate leaderboard / disconnect tearing down)
    vi.advanceTimersByTime(1000); // some ticks, but not all 90
    h.stopMpTicking();            // force-stop clears both timer and callback

    vi.advanceTimersByTime(10_000); // run out all remaining potential ticks
    expect(completed).not.toHaveBeenCalled();
  });

  it("REG-004: sweep-start arriving before animation completes queues DOM rebuild, not immediate", () => {
    // This is the core regression: sweep-start must NOT rebuild immediately
    // while mpTickTimer is non-null.
    const h = new TickHarness();
    const rebuildCalls: number[] = [];
    const fakeRebuild = () => rebuildCalls.push(Date.now());

    h.startMpTicking(30, 50); // animation in flight

    // Simulate sweep-start handler logic:
    if (h.mpTickTimer !== null) {
      h.onMpTickComplete = fakeRebuild; // deferred
    } else {
      fakeRebuild(); // immediate (should NOT run here)
    }

    // Immediately after sweep-start: rebuild must NOT have fired yet
    expect(rebuildCalls).toHaveLength(0);

    // After animation completes (70 ticks * 50ms = 3500ms):
    vi.advanceTimersByTime(4000);
    expect(rebuildCalls).toHaveLength(1);
  });

  it("REG-005: sweep-start arriving when no animation is in flight rebuilds immediately", () => {
    const h = new TickHarness();
    // No animation running — mpTickTimer is null.
    const rebuildCalls: string[] = [];
    const fakeRebuild = () => rebuildCalls.push("rebuilt");

    // Simulate sweep-start handler logic:
    if (h.mpTickTimer !== null) {
      h.onMpTickComplete = fakeRebuild;
    } else {
      fakeRebuild(); // should fire synchronously
    }

    expect(rebuildCalls).toEqual(["rebuilt"]);
  });

  it("REG-006: a second sweep-start replaces any previously queued onMpTickComplete", () => {
    // If two sweep-starts arrive in rapid succession (e.g. tiebreak edge case),
    // only the latest one's rebuild should fire.
    const h = new TickHarness();
    const log: string[] = [];

    h.startMpTicking(50, 50); // animation in flight

    // First sweep-start:
    if (h.mpTickTimer !== null) {
      h.onMpTickComplete = () => log.push("first");
    }
    // Second sweep-start overrides:
    if (h.mpTickTimer !== null) {
      h.onMpTickComplete = () => log.push("second");
    }

    vi.advanceTimersByTime(10_000);
    expect(log).toEqual(["second"]);
    expect(log).not.toContain("first");
  });
});
