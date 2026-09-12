import type { PlatformAdapter, StoragePort, ClockPort, SharePort, AssetPort } from "./ports.ts";

// Capacitor (iOS/Android) adapter. Uses @capacitor/preferences for KV persistence
// and @capacitor/share for the native share sheet. Preferences is async, so we
// mirror to an in-memory cache hydrated at boot to keep the StoragePort synchronous
// (matching the web adapter contract). Assets are bundled in the web build (dist)
// and read via fetch against the local app scheme — no network, no remote code.

import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";

const cache = new Map<string, string>();

/** Boot-time hydration: pull all known keys into the sync cache. */
export async function hydrateCapacitorStorage(keys: string[]): Promise<void> {
  for (const k of keys) {
    const { value } = await Preferences.get({ key: k });
    if (value !== null && value !== undefined) cache.set(k, value);
  }
}

const capStorage: StoragePort = {
  read: (k) => (cache.has(k) ? cache.get(k)! : null),
  write: (k, v) => {
    cache.set(k, v);
    void Preferences.set({ key: k, value: v });
  },
  remove: (k) => {
    cache.delete(k);
    void Preferences.remove({ key: k });
  },
};

const capClock: ClockPort = { nowMs: () => Date.now() };

const capShare: SharePort = {
  async share(text) {
    try {
      await Share.share({ text });
      return { ok: true, method: "share" };
    } catch {
      return { ok: false, method: "manual" };
    }
  },
};

const capAssets: AssetPort = {
  async loadText(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`asset load failed: ${path} (${res.status})`);
    return res.text();
  },
};

export const capacitorAdapter: PlatformAdapter = {
  storage: capStorage,
  clock: capClock,
  share: capShare,
  assets: capAssets,
};
