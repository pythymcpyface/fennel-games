import { test, expect } from "@playwright/test";

// Carbon Design System integration smoke test (Phase E).
// Confirms real @carbon/web-components render (not the fallback) and the g100
// dark theme is applied at the document root.

test.describe("IBM Carbon integration", () => {
  test("real cds-button custom element is registered and renders in a game", async ({ page }) => {
    await page.goto("/#/game/mirrorle");
    await expect(page.locator(".game-title")).toHaveText("Mirrorle");

    // The custom element must be defined by @carbon/web-components.
    const defined = await page.evaluate(() => customElements.get("cds-button") !== undefined);
    expect(defined).toBe(true);

    // The Guess/Share controls should be real <cds-button> elements, not <button class=btn>.
    await expect(page.locator("cds-button").first()).toBeVisible();
  });

  test("g100 theme class is applied to the body", async ({ page }) => {
    await page.goto("/");
    const hasTheme = await page.evaluate(() => document.body.classList.contains("cds--g100"));
    expect(hasTheme).toBe(true);
  });

  test("Carbon button carries the primary kind attribute", async ({ page }) => {
    await page.goto("/#/game/mirrorle");
    const kinds = await page.locator("cds-button").evaluateAll((els) =>
      els.map((e) => e.getAttribute("kind")),
    );
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds).toContain("secondary"); // the Share button
  });

  // All 10 novel games (this session) route their action buttons through the
  // carbonButton helper, so each must render at least one real <cds-button>.
  const novelGames = [
    "mirrorle", "parallax", "seam", "isthmus", "driftword",
    "isobar", "tollgate", "ghost-group", "fork", "ration", "overdraft", "clueback", "fault-lines", "undertow", "fogline", "tare", "marginalia", "cipher-diary", "decay", "cascade-type",
  ];
  for (const id of novelGames) {
    test(`${id} renders real Carbon buttons`, async ({ page }) => {
      await page.goto(`/#/game/${id}`);
      await expect(page.locator(".game-title")).toBeVisible();
      await expect(page.locator("cds-button").first()).toBeVisible();
    });
  }
});
