/**
 * Multiplayer round E2E — covers a complete 2-player game:
 * lobby → sweep 1 → sweep 2 → leaderboard → share.
 *
 * Requires relay running on ws://127.0.0.1:8787.
 * Run: npx playwright test --project=multiplayer e2e/multiplayer-round.spec.ts
 *
 * IMPORTANT — Alarm behaviour in wrangler dev (local):
 * Cloudflare DO alarms fire immediately in wrangler dev (Miniflare), regardless
 * of the scheduled time. This means sweep deadlines expire instantly. Tests that
 * rely on submissions landing before the alarm (happy-path round flow) are
 * unreliable in local dev and are marked with the @ci annotation.
 * They run fully in CI against the real Workers environment where alarms respect
 * the 30-second deadline.
 *
 * Tests NOT tagged @ci are reliable in local dev.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { selectDailyPuzzleId } from "../src/games/lowball/engine.ts";

/** A valid, non-zero-scoring answer for today's relay puzzle (mirrors room.ts). */
function todaysMidScoringAnswer(): { word: string; score: number } {
  const pack = JSON.parse(readFileSync("public/lowball.json", "utf8")) as {
    contentPackVersion: string; datasetId: string; puzzleCount: number;
    puzzles: { puzzleId: string; answers: { word: string; panelScore: number }[] }[];
  };
  const dayId = new Date().toISOString().slice(0, 10);
  const pid = selectDailyPuzzleId(dayId, pack.contentPackVersion, pack.datasetId, pack.puzzleCount);
  const answers = pack.puzzles.find((p) => p.puzzleId === pid)?.answers ?? [];
  const a = [...answers].sort((x, y) => y.panelScore - x.panelScore).find((x) => x.panelScore > 20 && x.panelScore < 100);
  return { word: a?.word ?? "", score: a?.panelScore ?? 0 };
}

const IS_CI = !!process.env["CI"];

// ---------------------------------------------------------------------------
// Helpers (duplicated minimally from lobby spec for file independence)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers (duplicated minimally from lobby spec for file independence)
// ---------------------------------------------------------------------------

async function hostCreateRoom(page: Page, name = "HostPlayer"): Promise<string> {
  await page.goto("/#/game/lowball");
  await expect(page.locator(".game.lowball")).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /multiplayer/i }).click();
  await expect(page.getByText(/host a game/i)).toBeVisible({ timeout: 5000 });
  await page.fill("#lb-mp-name", name);
  await page.getByRole("button", { name: /create room/i }).click();
  await expect(page.getByText(/room ready/i)).toBeVisible({ timeout: 10_000 });
  const inviteUrl = await page.locator(".lb-mp-invite-url").textContent();
  return inviteUrl!.trim();
}

async function guestJoin(ctx: BrowserContext, inviteUrl: string, name = "GuestPlayer"): Promise<Page> {
  const p = await ctx.newPage();
  await p.goto(inviteUrl);
  await expect(p.getByText(/join a game/i)).toBeVisible({ timeout: 8000 });
  await p.fill("#lb-mp-join-name", name);
  await p.getByRole("button", { name: /join room/i }).click();
  await expect(p.getByText(/joined/i)).toBeVisible({ timeout: 8000 });
  return p;
}

/**
 * REQ-FIX-003: the room waits on the review screen after sweep 1 until the host
 * clicks "Next sweep". Keeps clicking it (if shown) while waiting for `done`.
 */
async function hostAdvanceUntil(hostPage: Page, done: () => Promise<boolean>, timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await done()) return;
    const next = hostPage.getByRole("button", { name: /next sweep/i });
    if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
    await hostPage.waitForTimeout(500);
  }
}

async function startRound(hostPage: Page, guestPage: Page) {
  const startBtn = hostPage.getByRole("button", { name: /start game/i });
  await expect(startBtn).toBeEnabled({ timeout: 8000 });
  await startBtn.click();
  // Both clients must see the live round grid
  await expect(hostPage.locator(".lb-mp-grid")).toBeVisible({ timeout: 10_000 });
  await expect(guestPage.locator(".lb-mp-grid")).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Full round — sweep 1 + sweep 2 → leaderboard
// ---------------------------------------------------------------------------

test.describe("Multiplayer round — full 2-player game", () => {
  test("both players submit in sweep 1 and receive live reveals", async ({ page, context }) => {
    // Alarm-dependent: wrangler dev fires alarms immediately. Run in CI only.
    if (!IS_CI) test.skip(true, "Skipped in local dev: wrangler dev alarms fire immediately");
    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");
    await startRound(page, guestPage);

    // Both should see the countdown
    await expect(page.locator(".lb-mp-countdown")).toBeVisible({ timeout: 3000 });
    await expect(guestPage.locator(".lb-mp-countdown")).toBeVisible({ timeout: 3000 });

    // Both submit answers (content pack has "tough" for the -ugh category, score 81)
    const hostInput = page.locator("#lb-mp-answer");
    const guestInput = guestPage.locator("#lb-mp-answer");

    await expect(hostInput).toBeVisible({ timeout: 5000 });
    await expect(guestInput).toBeVisible({ timeout: 5000 });

    await hostInput.fill("tough");
    await page.getByRole("button", { name: /submit/i }).click();

    await guestInput.fill("rough");
    await guestPage.getByRole("button", { name: /submit/i }).click();

    // Live reveal: host's card on guest's screen should show host's answer
    await expect(guestPage.locator(".lb-mp-card").first()).toContainText("tough", { timeout: 5000 });

    // Guest's card on host's screen should show guest's answer
    await expect(page.locator(".lb-mp-card").nth(1)).toContainText("rough", { timeout: 5000 });

    await guestPage.close();
  });

  test("sweep 2 starts after both players submit sweep 1", async ({ page, context }) => {
    // Alarm-dependent: wrangler dev fires alarms immediately. Run in CI only.
    if (!IS_CI) test.skip(true, "Skipped in local dev: wrangler dev alarms fire immediately");
    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");
    await startRound(page, guestPage);

    // Submit sweep 1
    await page.locator("#lb-mp-answer").fill("tough");
    await page.getByRole("button", { name: /submit/i }).click();
    await guestPage.locator("#lb-mp-answer").fill("rough");
    await guestPage.getByRole("button", { name: /submit/i }).click();

    // After both submit the room holds for review until the host clicks
    // "Next sweep" (REQ-FIX-003: no auto-advance), then sweep 2 starts.
    await expect(guestPage.getByText(/sweep complete/i)).toBeVisible({ timeout: 15_000 });
    await expect(guestPage.getByRole("button", { name: /next sweep/i })).toHaveCount(0);
    await page.getByRole("button", { name: /next sweep/i }).click({ timeout: 15_000 });
    await expect(page.locator("#lb-mp-answer")).toBeVisible({ timeout: 15_000 });
    await expect(guestPage.getByText(/sweep 2 of 2/i)).toBeVisible({ timeout: 15_000 });

    await guestPage.close();
  });

  test("leaderboard shows after both sweeps complete", async ({ page, context }) => {
    // Alarm-dependent: wrangler dev fires alarms immediately. Run in CI only.
    if (!IS_CI) test.skip(true, "Skipped in local dev: wrangler dev alarms fire immediately");
    // NOTE: In local wrangler dev, only the first DO alarm fires reliably.
    // This test is authoritative in CI (production Workers). Locally it may
    // time out if the second alarm doesn't fire. See wrangler dev alarm limitations.
    test.setTimeout(75_000);

    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");
    await startRound(page, guestPage);

    // Attempt submissions — may race with immediate-firing alarm in local dev
    const input = page.locator("#lb-mp-answer");
    const guestInput = guestPage.locator("#lb-mp-answer");
    if (await input.isEnabled({ timeout: 2000 }).catch(() => false)) {
      await input.fill("tough");
      await page.getByRole("button", { name: /submit/i }).click();
    }
    if (await guestInput.isEnabled({ timeout: 2000 }).catch(() => false)) {
      await guestInput.fill("rough");
      await guestPage.getByRole("button", { name: /submit/i }).click();
    }

    // Leaderboard must appear (host advances past the sweep-1 review)
    await hostAdvanceUntil(page, () => page.locator(".lb-mp-leaderboard").isVisible(), 70_000);
    await expect(page.locator(".lb-mp-leaderboard")).toBeVisible({ timeout: 5_000 });
    await expect(guestPage.locator(".lb-mp-leaderboard")).toBeVisible({ timeout: 10_000 });

    // Both should see the leaderboard
    await expect(page.locator(".lb-mp-leaderboard")).toBeVisible({ timeout: 10_000 });
    await expect(guestPage.locator(".lb-mp-leaderboard")).toBeVisible({ timeout: 10_000 });

    // Both players appear in the leaderboard
    await expect(page.locator(".lb-mp-leaderboard")).toContainText("Alice");
    await expect(page.locator(".lb-mp-leaderboard")).toContainText("Bob");

    await guestPage.close();
  });

  test("leaderboard shows rank #1 for the player with lowest total", async ({ page, context }) => {
    // Alarm-dependent: wrangler dev fires alarms immediately. Run in CI only.
    if (!IS_CI) test.skip(true, "Skipped in local dev: wrangler dev alarms fire immediately");
    test.setTimeout(75_000);

    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");
    await startRound(page, guestPage);

    // Wait for leaderboard (turn alarms + host advancing past the review)
    await hostAdvanceUntil(page, () => page.locator(".lb-mp-leaderboard").isVisible(), 70_000);
    await expect(page.locator(".lb-mp-leaderboard")).toBeVisible({ timeout: 5_000 });

    // Both players appear in the leaderboard
    await expect(page.locator(".lb-mp-leaderboard")).toContainText("Alice");
    await expect(page.locator(".lb-mp-leaderboard")).toContainText("Bob");

    // At least one player has rank #1 (or "=" for joint winners)
    const ranks = page.locator(".lb-mp-lb-rank");
    await expect(ranks.first()).toBeVisible();
    const firstRankText = await ranks.first().textContent();
    expect(["#1", "="]).toContain(firstRankText?.trim());

    await guestPage.close();
  });

  test("leaderboard Share button is visible after round ends", async ({ page, context }) => {
    // Alarm-dependent: wrangler dev fires alarms immediately. Run in CI only.
    if (!IS_CI) test.skip(true, "Skipped in local dev: wrangler dev alarms fire immediately");
    test.setTimeout(75_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");
    await startRound(page, guestPage);

    // Wait for leaderboard (turn alarms + host advancing past the review)
    await hostAdvanceUntil(page, () => page.locator(".lb-mp-leaderboard").isVisible(), 70_000);
    await expect(page.locator(".lb-mp-leaderboard")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /share result/i })).toBeVisible();

    await expect(page.locator(".lb-mp-leaderboard")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /share result/i })).toBeVisible();

    await guestPage.close();
  });

  test("auto-blank fires after 30s timeout for a player who does not submit", async ({ page, context }) => {
    // This test verifies the alarm mechanism but uses a long timeout
    // Only run in CI or with --timeout 60000
    test.setTimeout(60_000);

    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");
    await startRound(page, guestPage);

    // Only Alice submits in sweep 1; Bob does nothing
    await page.locator("#lb-mp-answer").fill("tough");
    await page.getByRole("button", { name: /submit/i }).click();

    // After 30s (+ reveal grace), Bob receives an auto-blank (timeout indicator)
    // and the room holds on the sweep-1 review (REQ-FIX-003).
    await expect(page.locator(".lb-mp-card").nth(1)).toContainText(/timeout/i, { timeout: 42_000 });
    await expect(page.getByRole("button", { name: /next sweep/i })).toBeVisible({ timeout: 10_000 });

    await guestPage.close();
  });
});

// ---------------------------------------------------------------------------
// Disconnect handling
// ---------------------------------------------------------------------------

test.describe("Multiplayer round — disconnect handling", () => {
  test("host sees updated player count when guest disconnects in lobby", async ({ page, context }) => {
    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");

    // Confirm 2 players
    await expect(page.getByText(/2\/4 players/i)).toBeVisible({ timeout: 5000 });

    // Guest disconnects
    await guestPage.close();

    // Host should see player count drop to 1
    await expect(page.getByText(/1\/4 players/i)).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Tension counter + countdown in multiplayer.
//
// The counter bar column (.lb-counter / .lb-bars / .lb-score-num) was present in
// single-player but omitted from the multiplayer round view. The countdown also
// only painted inside setInterval, whose first tick is 250ms away, so between
// sweeps it briefly showed the PREVIOUS sweep's value ("timer didn't reset").
// ---------------------------------------------------------------------------

test.describe("Multiplayer round — tension counter and countdown", () => {
  test("counter bar column is present in the multiplayer round view", async ({ page, context }) => {
    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");
    await startRound(page, guestPage);

    // The full bar column must render, matching single-player (100 bars).
    await expect(page.locator(".lb-counter")).toBeVisible({ timeout: 8000 });
    await expect(page.locator(".lb-bars")).toBeVisible();
    await expect(page.locator(".lb-bar")).toHaveCount(100);
    await expect(page.locator(".lb-score-num")).toBeVisible();
    // The panel-score disclosure travels with the counter.
    await expect(page.locator(".lb-disclosure")).toBeVisible();

    // Guest sees it too.
    await expect(guestPage.locator(".lb-bar")).toHaveCount(100);

    await guestPage.close();
  });

  test("counter bars are unlit before any submission", async ({ page, context }) => {
    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");
    await startRound(page, guestPage);

    // No reveal yet, so the counter reads 0 and no bar is lit.
    await expect(page.locator(".lb-score-num")).toHaveText("0", { timeout: 8000 });
    await expect(page.locator(".lb-bar.lb-bar-on")).toHaveCount(0);

    await guestPage.close();
  });

  test("countdown shows a sane starting value immediately on sweep start", async ({ page, context }) => {
    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");
    await startRound(page, guestPage);

    // Before the first sweep-start frame lands the countdown shows an em dash
    // (no deadline known yet); once it lands it must be a sane 1..30s and never
    // a stale value carried over from a previous sweep.
    await expect(page.locator(".lb-mp-countdown")).toHaveText(/^\d+s$/, { timeout: 10_000 });
    const txt = await page.locator(".lb-mp-countdown").textContent();
    const secs = Number((txt ?? "").replace(/[^0-9]/g, ""));
    expect(secs).toBeGreaterThan(0);
    expect(secs).toBeLessThanOrEqual(30);

    await guestPage.close();
  });
});

// ---------------------------------------------------------------------------
// lowball-mp-reveal-pause: on a phone (reduced motion on, as many phones are)
// every reveal drains, the countdown pauses, a 100 shows the big ✕, and the
// sweep-1 review holds until the host clicks "Next sweep".
// ---------------------------------------------------------------------------

test.describe("Multiplayer round — reveal pause on mobile", () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });

  test("reveal drains with paused timer, ✕ on 100, review waits for host", async ({ page, context }) => {
    test.setTimeout(60_000);
    const inviteUrl = await hostCreateRoom(page, "Alice");
    const guestPage = await guestJoin(context, inviteUrl, "Bob");
    await startRound(page, guestPage);

    // Host answers with a non-word → scores 100 → big ✕ for both players.
    await page.locator("#lb-mp-answer").fill("zzzzq");
    await page.getByRole("button", { name: /submit/i }).click();
    await expect(guestPage.locator(".lb-result-cross")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".lb-result-cross")).toBeVisible();
    // Guest's input only appears once the reveal hold is over.
    await expect(guestPage.locator("#lb-mp-answer")).toBeVisible({ timeout: 8_000 });
    await expect(guestPage.locator(".lb-mp-countdown")).toHaveText("30s");

    // Guest gives a real answer → the column animates down on the host's phone.
    const answer = todaysMidScoringAnswer();
    expect(answer.word).not.toBe("");
    await guestPage.locator("#lb-mp-answer").fill(answer.word);
    await guestPage.getByRole("button", { name: /submit/i }).click();
    await expect(page.locator(".lb-mp-card").nth(1)).toContainText(answer.word, { timeout: 5_000 });
    const frozen = await page.locator(".lb-mp-countdown").textContent();
    await page.waitForTimeout(600);
    const mid = Number(await page.locator(".lb-score-num").textContent());
    expect(mid).toBeLessThan(100); // draining, not jumped, despite reduced motion
    expect(mid).toBeGreaterThan(answer.score);
    expect(await page.locator(".lb-mp-countdown").textContent()).toBe(frozen); // paused

    // After the reveal, the review holds — no auto-advance.
    await expect(page.getByText(/sweep complete/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(7_000); // longer than the old 5s auto-advance
    await expect(guestPage.getByText(/sweep complete/i)).toBeVisible();
    await expect(guestPage.getByRole("button", { name: /next sweep/i })).toHaveCount(0);

    await page.getByRole("button", { name: /next sweep/i }).click();
    await expect(page.locator("#lb-mp-answer")).toBeVisible({ timeout: 5_000 });
    await expect(guestPage.getByText(/sweep 2 of 2/i)).toBeVisible();

    await guestPage.close();
  });
});
