/**
 * Multiplayer lobby E2E — covers JOURNEY-001, JOURNEY-002, JOURNEY-003.
 *
 * Bugs under test (RED before fix):
 *   BUG-1: Start Game button stays disabled after guest joins (wsToSlot lost on hibernation)
 *   BUG-2: Copy invite link button shows no feedback / doesn't copy (detached live node)
 *
 * Requires:
 *   - `npm run preview` serving the app on http://localhost:4180
 *   - `wrangler dev` running the relay on ws://127.0.0.1:8787 (port 8787 HTTP for /create)
 *   - The built app must point VITE_RELAY_URL at ws://127.0.0.1:8787 (default fallback)
 *
 * Run: npx playwright test --project=multiplayer e2e/multiplayer-lobby.spec.ts
 */

import { test, expect, type BrowserContext, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goToLowball(page: Page) {
  await page.goto("/#/game/lowball");
  await expect(page.locator(".game.lowball")).toBeVisible({ timeout: 5000 });
}

async function clickMultiplayer(page: Page) {
  await page.getByRole("button", { name: /multiplayer/i }).click();
  // Should now see the lobby — "Host a game" heading
  await expect(page.getByText(/host a game/i)).toBeVisible({ timeout: 5000 });
}

/** Host creates a room and returns the invite URL extracted from the lobby. */
async function hostCreateRoom(page: Page, displayName = "HostPlayer"): Promise<string> {
  await goToLowball(page);
  await clickMultiplayer(page);

  // Fill host name and create room
  await page.fill("#lb-mp-name", displayName);
  await page.getByRole("button", { name: /create room/i }).click();

  // Wait for room ready state — invite link is displayed
  await expect(page.getByText(/room ready/i)).toBeVisible({ timeout: 10_000 });

  // Extract the invite URL from the displayed link
  const inviteText = await page.locator(".lb-mp-invite-url").textContent();
  expect(inviteText).toBeTruthy();
  expect(inviteText).toContain("#/game/lowball?room=");
  return inviteText!.trim();
}

/** Guest joins via invite URL and enters their display name. */
async function guestJoinRoom(
  context: BrowserContext,
  inviteUrl: string,
  displayName = "GuestPlayer",
): Promise<Page> {
  const guestPage = await context.newPage();

  // Navigate to invite URL (it's a hash URL so we need to handle the base + hash)
  // inviteUrl looks like: http://localhost:4180/#/game/lowball?room=ABC123
  await guestPage.goto(inviteUrl);

  // Should land on lobby with join form
  await expect(guestPage.getByText(/join a game/i)).toBeVisible({ timeout: 8000 });

  // Room code should be pre-filled from URL
  const codeInput = guestPage.locator("#lb-mp-code");
  await expect(codeInput).toHaveValue(/[A-Z0-9]{6}/);

  // Fill guest name and join
  await guestPage.fill("#lb-mp-join-name", displayName);
  await guestPage.getByRole("button", { name: /join room/i }).click();

  // Wait for joined state
  await expect(guestPage.getByText(/joined/i)).toBeVisible({ timeout: 8000 });

  return guestPage;
}

// ---------------------------------------------------------------------------
// JOURNEY-001: Host creates room, sees lobby, invite link is correct
// ---------------------------------------------------------------------------

test.describe("Multiplayer lobby — JOURNEY-001: Host creates room", () => {
  test("host sees room ready with a valid invite link after creating a room", async ({ page }) => {
    const inviteUrl = await hostCreateRoom(page);

    // Invite link must contain the correct format
    expect(inviteUrl).toMatch(/http:\/\/localhost:4180\/#\/game\/lowball\?room=[A-Z0-9]{6}/);

    // Room code is also shown in plain text
    await expect(page.getByText(/room code:/i)).toBeVisible();

    // Player count shows 1/4
    await expect(page.getByText(/1\/4 players/i)).toBeVisible();
  });

  test("Start Game button is disabled when only host is in lobby", async ({ page }) => {
    await hostCreateRoom(page);

    const startBtn = page.getByRole("button", { name: /start game/i });
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// JOURNEY-003 / BUG-2: Copy invite link
// ---------------------------------------------------------------------------

test.describe("Multiplayer lobby — JOURNEY-003 / BUG-2: Copy invite link", () => {
  test("clicking Copy invite link shows confirmation feedback", async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const inviteUrl = await hostCreateRoom(page);

    // Click the copy button
    await page.getByRole("button", { name: /copy invite link/i }).click();

    // BUG-2 FIX VERIFICATION: Visible feedback must appear
    // (Before fix: live node is detached so no text appears)
    await expect(page.getByRole("status")).toContainText(/copied|shared/i, { timeout: 3000 });
  });

  test("clipboard contains the invite URL after clicking copy", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const inviteUrl = await hostCreateRoom(page);

    await page.getByRole("button", { name: /copy invite link/i }).click();

    // Small wait for async clipboard write
    await page.waitForTimeout(500);

    // Read clipboard and verify
    const clipped = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipped).toContain("#/game/lowball?room=");
    expect(clipped).toBe(inviteUrl);
  });
});

// ---------------------------------------------------------------------------
// JOURNEY-002 / BUG-1: Guest joins, Start button enables, start works
// ---------------------------------------------------------------------------

test.describe("Multiplayer lobby — JOURNEY-002 / BUG-1: Guest join enables Start", () => {
  test("Start Game button enables after guest joins the room", async ({ page, context }) => {
    const inviteUrl = await hostCreateRoom(page);

    // Guest joins in a second tab (same browser context = same origin = clipboard permission)
    const guestPage = await guestJoinRoom(context, inviteUrl);

    // BUG-1 FIX VERIFICATION: Host's Start button must become enabled
    // (Before fix: wsToSlot lost on hibernation → start rejected → button appears enabled
    //  but actually stays broken; the more visible symptom is the button never enabling)
    const startBtn = page.getByRole("button", { name: /start game/i });
    await expect(startBtn).toBeEnabled({ timeout: 8000 });

    // Player count on host shows 2/4
    await expect(page.getByText(/2\/4 players/i)).toBeVisible({ timeout: 5000 });

    // Guest also sees both players
    await expect(guestPage.getByText(/2\/4 players/i)).toBeVisible({ timeout: 5000 });

    await guestPage.close();
  });

  test("Host can click Start and round begins after guest joins", async ({ page, context }) => {
    const inviteUrl = await hostCreateRoom(page);
    const guestPage = await guestJoinRoom(context, inviteUrl);

    // Wait for Start to enable
    const startBtn = page.getByRole("button", { name: /start game/i });
    await expect(startBtn).toBeEnabled({ timeout: 8000 });

    // Click Start
    await startBtn.click();

    // BUG-1 FIX VERIFICATION: Both clients should transition to live round view
    // (Before fix: start message rejected by DO → neither client transitions)
    await expect(page.locator(".lb-mp-grid")).toBeVisible({ timeout: 10_000 });
    await expect(guestPage.locator(".lb-mp-grid")).toBeVisible({ timeout: 10_000 });

    // Both should see the category prompt
    await expect(page.locator(".lb-prompt")).toBeVisible({ timeout: 5000 });
    await expect(guestPage.locator(".lb-prompt")).toBeVisible({ timeout: 5000 });

    await guestPage.close();
  });

  test("player list shows both players with correct names", async ({ page, context }) => {
    const inviteUrl = await hostCreateRoom(page, "HostAlice");
    const guestPage = await guestJoinRoom(context, inviteUrl, "GuestBob");

    // Host sees both players
    await expect(page.locator(".lb-mp-player-list")).toContainText("HostAlice", { timeout: 5000 });
    await expect(page.locator(".lb-mp-player-list")).toContainText("GuestBob", { timeout: 5000 });

    // Guest also sees both
    await expect(guestPage.locator(".lb-mp-player-list")).toContainText("HostAlice", { timeout: 5000 });
    await expect(guestPage.locator(".lb-mp-player-list")).toContainText("GuestBob", { timeout: 5000 });

    await guestPage.close();
  });
});

// ---------------------------------------------------------------------------
// BUG-3 REGRESSION: DO hibernation between host-create and guest-join.
//
// The original e2e suite passed while the bug was live because host-create and
// guest-join happened milliseconds apart, so the Durable Object never idled long
// enough to hibernate. The real-world repro includes human delay (host copies the
// link, switches tabs, pastes). These tests insert that delay explicitly.
//
// Before the fix: roomState (in-memory only) reset to null on hibernation, so the
// guest was made host of a fresh empty room and the real host was orphaned —
// the host's Start button stayed disabled and the guest waited for itself.
// ---------------------------------------------------------------------------

test.describe("Multiplayer lobby — BUG-3: state survives DO hibernation", () => {
  const IDLE_MS = 12_000; // comfortably beyond the DO idle-hibernation threshold

  test("host stays host and Start enables when guest joins after an idle gap", async ({ page, context }) => {
    test.setTimeout(60_000);

    const inviteUrl = await hostCreateRoom(page, "HostAlice");

    // Simulate the host copying the link and switching tabs. The DO goes idle
    // and hibernates during this window.
    await page.waitForTimeout(IDLE_MS);

    const guestPage = await guestJoinRoom(context, inviteUrl, "GuestBob");

    // The guest must NOT have been promoted to host of a new room.
    await expect(guestPage.getByText(/waiting for host to start/i)).toBeVisible({ timeout: 8000 });

    // The host must still see itself plus the guest, and Start must enable.
    await expect(page.locator(".lb-mp-player-list")).toContainText("HostAlice", { timeout: 8000 });
    await expect(page.locator(".lb-mp-player-list")).toContainText("GuestBob", { timeout: 8000 });
    await expect(page.getByText(/2\/4 players/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /start game/i })).toBeEnabled({ timeout: 8000 });

    await guestPage.close();
  });

  test("host can start the round after an idle gap", async ({ page, context }) => {
    test.setTimeout(60_000);

    const inviteUrl = await hostCreateRoom(page, "HostAlice");
    await page.waitForTimeout(IDLE_MS);
    const guestPage = await guestJoinRoom(context, inviteUrl, "GuestBob");

    const startBtn = page.getByRole("button", { name: /start game/i });
    await expect(startBtn).toBeEnabled({ timeout: 8000 });
    await startBtn.click();

    // Both clients must reach the live round — proves the DO accepted the
    // start message from the rehydrated host slot.
    await expect(page.locator(".lb-mp-grid")).toBeVisible({ timeout: 10_000 });
    await expect(guestPage.locator(".lb-mp-grid")).toBeVisible({ timeout: 10_000 });

    await guestPage.close();
  });
});
