import type { PlatformAdapter, StoragePort, ClockPort, SharePort, AssetPort } from "./ports.ts";

// Web/PWA adapter. Uses localStorage for simple KV (game state + stats are small),
// Web Share API with clipboard fallback, and fetch for bundled assets (precached
// by the service worker for offline cold-start).

const webStorage: StoragePort = {
  read: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  write: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* quota/permission — session continues in memory upstream */
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

const webClock: ClockPort = { nowMs: () => Date.now() };

const webShare: SharePort = {
  async share(text) {
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ text });
        return { ok: true, method: "share" };
      } catch {
        /* fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: "clipboard" };
    } catch {
      return { ok: false, method: "manual" };
    }
  },
};

const webAssets: AssetPort = {
  async loadText(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`asset load failed: ${path} (${res.status})`);
    return res.text();
  },
};

export const webAdapter: PlatformAdapter = {
  storage: webStorage,
  clock: webClock,
  share: webShare,
  assets: webAssets,
};
