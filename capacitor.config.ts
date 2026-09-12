import type { CapacitorConfig } from "@capacitor/cli";

// Offline-first: the built web assets (app shell + bundled daily puzzle data) are
// packaged in the native binary. No runtime remote code (Apple 2.5.2 / Google Play):
// all logic and data ship inside the reviewed app.
const config: CapacitorConfig = {
  appId: "com.fennelgames.app",
  appName: "Fennel Games",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
