import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Offline-first PWA hub. App shell + every game's content pack precached.
// No remote code at runtime (Apple 2.5.2): all games + data ship in the binary.
export default defineConfig({
  base: "./",
  build: { target: "es2022", sourcemap: true },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/main.ts",
        "src/hub/**",
        "src/games/**/plugin.ts",
        "src/kit/types.ts",
        "src/kit/ports.ts",
        "src/kit/web-adapter.ts",
        "src/kit/cap-adapter.ts",
        "src/kit/composition-root.ts",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      manifest: {
        name: "Fennel Games",
        short_name: "Fennel Games",
        description: "A hub of offline-first daily word puzzles",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "./",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"],
        // Content packs (e.g. ladderless.json with the en-GB accept-list) exceed
        // the 2 MiB default; raise so the offline-first PWA precaches them.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
});
