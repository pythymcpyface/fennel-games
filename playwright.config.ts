import { defineConfig, devices } from "@playwright/test";

// E2E across desktop + mobile viewports (proxies for WKWebView/Android WebView).
// The app is a static build served locally; no network at play time (NFR-001/005).
//
// Multiplayer tests run under the "multiplayer" project only, which also starts
// `wrangler dev` on port 8787 so the lobby/round flows have a real relay.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  projects: [
    // -----------------------------------------------------------------------
    // Standard single-player projects (no relay needed)
    // -----------------------------------------------------------------------
    {
      name: "chromium",
      testIgnore: ["**/multiplayer*.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      testIgnore: ["**/multiplayer*.spec.ts"],
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "mobile-chrome",
      testIgnore: ["**/multiplayer*.spec.ts"],
      use: { ...devices["Pixel 7"] },
    },
    // -----------------------------------------------------------------------
    // Multiplayer project — starts relay + preview server
    // Run with: npx playwright test --project=multiplayer
    // -----------------------------------------------------------------------
    {
      name: "multiplayer",
      testMatch: ["**/multiplayer*.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:4180",
        // Relay URL injected into the built app via VITE_RELAY_URL at build time.
        // For local testing, wrangler dev listens on ws://127.0.0.1:8787 which
        // matches the default RELAY_BASE_URL fallback in plugin.ts.
      },
    },
  ],
  webServer: [
    // PWA preview (all projects)
    {
      command: "npm run preview",
      port: 4180,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    // Relay (multiplayer project only — wrangler dev on 8787)
    {
      command: "cd workers/lowball-relay && npm install --silent && npx wrangler dev --port 8787 --local",
      port: 8787,
      reuseExistingServer: true,
      timeout: 90_000,
    },
  ],
});
