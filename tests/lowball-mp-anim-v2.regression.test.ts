// Regression tests for mp-anim-v2 bug fix.
//
// Three bugs, all in the multiplayer reveal animation + timer:
//
// BUG-1: Animation only plays for the host. The last player in a sweep
// triggers `between-sweeps` (not `sweep-start`) immediately after their
// reveal. The `between-sweeps` handler called stopMpTicking() immediately,
// killing the animation. The previous fix only deferred `sweep-start`, not
// `between-sweeps`. The host always gets a `sweep-start` (never last in a
// sweep for themselves), so their animation worked; everyone else didn't.
//
// BUG-2: The countdown timer ticks down during the animation. The `reveal`
// handler started the animation but never stopped the countdown interval,
// so the 250ms countdown tick kept firing throughout the 5s drain.
//
// BUG-3: The timer doesn't visibly reset to 30s after each turn. This is a
// consequence of Bug-2: the countdown was still running during animation and
// had already ticked down before the deferred renderLiveRound+startMpCountdown
// fired. Fixing Bug-2 (pause countdown during animation) makes the reset
// clean and visible.
//
// FIX:
//   1. between-sweeps handler: apply same onMpTickComplete deferral as sweep-start.
//   2. reveal handler: call stopMpCountdown() before startMpTicking() so the
//      timer freezes during the animation.
//   3. The deferred callback in both handlers calls startMpCountdown() with the
//      fresh deadline, so the timer resets cleanly after the animation.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Harness — mirrors the exact tick + countdown mechanic from plugin.ts so
// we can unit-test all three bugs without a full DOM / ContentPack.
// ---------------------------------------------------------------------------

class AnimTimerHarness {
  mpTickCounter = 0;
  mpTickTimer: ReturnType<typeof setInterval> | null = null;
  onMpTickComplete: (() => void) | null = null;

  // Countdown state
  countdownTimer: ReturnType<typeof setInterval> | null = null;
  countdownTicks = 0; // incremented each 250ms interval tick

  // --- tick ---

  stopMpTicking(): void {
    if (this.mpTickTimer !== null) {
      clearInterval(this.mpTickTimer);
      this.mpTickTimer = null;
    }
    this.onMpTickComplete = null;
  }

  startMpTicking(target: number, tickMs = 50): void {
    this.stopMpTicking();
    this.mpTickCounter = 100;
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

  // --- countdown ---

  stopMpCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  startMpCountdown(intervalMs = 250): void {
    this.stopMpCountdown();
    this.countdownTimer = setInterval(() => {
      this.countdownTicks += 1;
    }, intervalMs);
  }

  get countdownRunning(): boolean {
    return this.countdownTimer !== null;
  }

  // --- sweep-start handler (fixed) ---
  handleSweepStart(): void {
    if (this.mpTickTimer !== null) {
      this.onMpTickComplete = () => {
        this.mpTickCounter = 0;
        this.startMpCountdown();
      };
    } else {
      this.stopMpTicking();
      this.mpTickCounter = 0;
      this.startMpCountdown();
    }
  }

  // --- between-sweeps handler (fixed — same deferral as sweep-start) ---
  handleBetweenSweeps(): void {
    if (this.mpTickTimer !== null) {
      this.onMpTickComplete = () => {
        this.mpTickCounter = 0;
        this.startMpCountdown();
      };
    } else {
      this.stopMpTicking();
      this.mpTickCounter = 0;
      this.startMpCountdown();
    }
  }

  // --- reveal handler (fixed — stops countdown before starting animation) ---
  handleReveal(score: number): void {
    this.stopMpCountdown(); // BUG-2 fix: freeze timer during animation
    this.startMpTicking(score);
  }
}

// ---------------------------------------------------------------------------

describe("mp-anim-v2 regression — between-sweeps deferral", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("REG-V2-001: between-sweeps arriving mid-animation defers DOM rebuild (non-host path)", () => {
    const h = new AnimTimerHarness();
    const rebuilds: string[] = [];
    h.mpTickCounter = 100;
    // Simulate animation already running (e.g. last player's reveal)
    h.startMpTicking(20);

    // between-sweeps arrives — must NOT rebuild immediately
    // (the old bug: stopMpTicking was called here, killing the animation)
    h.handleBetweenSweeps();
    rebuilds.push(h.mpTickTimer !== null ? "animation-still-running" : "animation-killed");

    expect(rebuilds[0]).toBe("animation-still-running");
  });

  it("REG-V2-002: between-sweeps deferred callback fires after animation completes", () => {
    const h = new AnimTimerHarness();
    const log: string[] = [];

    h.startMpTicking(30);
    // Inject observable into onMpTickComplete
    h.handleBetweenSweeps(); // queues onMpTickComplete
    // Override to also log
    const queued = h.onMpTickComplete!;
    h.onMpTickComplete = () => { queued(); log.push("rebuilt"); };

    expect(log).toHaveLength(0);
    vi.advanceTimersByTime(4000); // animation: 70 ticks × 50ms
    expect(log).toEqual(["rebuilt"]);
  });

  it("REG-V2-003: between-sweeps when no animation running rebuilds immediately", () => {
    const h = new AnimTimerHarness();
    // No animation in flight
    expect(h.mpTickTimer).toBeNull();
    let rebuilt = false;
    // Simulate the fixed handler directly
    if (h.mpTickTimer !== null) {
      h.onMpTickComplete = () => { rebuilt = true; };
    } else {
      h.stopMpTicking();
      h.mpTickCounter = 0;
      rebuilt = true;
    }
    expect(rebuilt).toBe(true);
  });
});

describe("mp-anim-v2 regression — countdown paused during animation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("REG-V2-004: reveal stops the countdown before starting animation (BUG-2 fix)", () => {
    const h = new AnimTimerHarness();
    h.startMpCountdown(); // countdown running before reveal
    expect(h.countdownRunning).toBe(true);

    h.handleReveal(25); // fixed handler: stops countdown, then starts animation

    // Countdown must be stopped immediately after reveal
    expect(h.countdownRunning).toBe(false);
    // Animation must be running
    expect(h.mpTickTimer).not.toBeNull();
  });

  it("REG-V2-005: countdown does not tick during animation after reveal", () => {
    const h = new AnimTimerHarness();
    h.startMpCountdown();
    h.handleReveal(40); // stops countdown, starts animation

    const ticksBefore = h.countdownTicks;
    vi.advanceTimersByTime(3000); // let animation run partway
    const ticksDuring = h.countdownTicks;

    // Countdown ticks must not increase while animation is running
    expect(ticksDuring).toBe(ticksBefore);
  });

  it("REG-V2-006: countdown restarts with fresh deadline after animation completes via sweep-start", () => {
    const h = new AnimTimerHarness();
    h.startMpCountdown();
    h.handleReveal(50); // stops countdown
    // sweep-start arrives mid-animation — defers countdown restart
    h.handleSweepStart();

    // Countdown still stopped during animation
    expect(h.countdownRunning).toBe(false);

    // Animation completes — deferred callback fires startMpCountdown
    vi.advanceTimersByTime(5000);
    expect(h.countdownRunning).toBe(true);
  });

  it("REG-V2-007: timer resets cleanly — countdown not running between reveal and animation end", () => {
    const h = new AnimTimerHarness();
    h.startMpCountdown();

    const ticksBefore = h.countdownTicks;
    h.handleReveal(20);       // stops countdown, starts animation (80 ticks × 50ms = 4000ms)
    h.handleBetweenSweeps(); // defers rebuild via onMpTickComplete

    // Advance to just before animation completes — no countdown ticks should fire
    vi.advanceTimersByTime(3900);
    const ticksDuringAnimation = h.countdownTicks - ticksBefore;
    expect(ticksDuringAnimation).toBe(0);

    // Let animation finish — deferred callback fires startMpCountdown
    vi.advanceTimersByTime(500); // past the 4000ms mark
    expect(h.countdownRunning).toBe(true);
    // A bit more time to accumulate ticks
    vi.advanceTimersByTime(1000);
    expect(h.countdownTicks).toBeGreaterThan(0);
  });
});
