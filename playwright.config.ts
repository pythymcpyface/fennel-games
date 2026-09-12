import { defineConfig, devices } from "@playwright/test";

// E2E across desktop + mobile viewports (proxies for WKWebView/Android WebView).
// The app is a static build served locally; no network at play time (NFR-001/005).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  webServer: {
    command: "npm run preview",
    port: 4180,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: {
    baseURL: "http://localhost:4180",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
