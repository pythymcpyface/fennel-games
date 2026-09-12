import type { PlatformAdapter } from "./ports.ts";
import type { PlatformId } from "./types.ts";
import { webAdapter } from "./web-adapter.ts";

// Composition root. Detects platform and selects the adapter. Capacitor adapter is
// imported lazily so the PWA build does not pull native plugin code.

export function detectPlatform(): PlatformId {
  const w = globalThis as { Capacitor?: { getPlatform?: () => string } };
  const p = w.Capacitor?.getPlatform?.();
  if (p === "ios") return "ios";
  if (p === "android") return "android";
  return "web";
}

export async function resolveAdapter(platform: PlatformId): Promise<PlatformAdapter> {
  if (platform === "ios" || platform === "android") {
    const { capacitorAdapter } = await import("./cap-adapter.ts");
    return capacitorAdapter;
  }
  return webAdapter;
}
