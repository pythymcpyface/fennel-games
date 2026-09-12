// Platform adapter ports (TERM-027). The pure core never imports these; the
// Game Controller receives implementations from the composition root. Web and
// Capacitor provide concrete adapters behind these interfaces.

/** Key-value storage port (web: localStorage/IndexedDB; Capacitor: Preferences). */
export interface StoragePort {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

/** Clock port — the only source of "now" (core stays clock-free). */
export interface ClockPort {
  nowMs(): number;
}

/** Share port — native/web share with clipboard fallback. */
export interface SharePort {
  share(text: string): Promise<{ ok: boolean; method: "share" | "clipboard" | "manual" }>;
}

/** Asset loading port — bundled content-pack assets. */
export interface AssetPort {
  loadText(path: string): Promise<string>;
}

export interface PlatformAdapter {
  storage: StoragePort;
  clock: ClockPort;
  share: SharePort;
  assets: AssetPort;
}
