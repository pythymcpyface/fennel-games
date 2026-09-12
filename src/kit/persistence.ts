import type { StoragePort } from "./ports.ts";

// Generic schema-versioned attempt persistence. Each game stores its own state
// shape under a namespaced key; a repair callback clamps loaded data.

export const SAVE_SCHEMA_VERSION = 1;

export function saveAttempt<T>(storage: StoragePort, key: string, state: T): void {
  storage.write(key, JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, state }));
}

export function loadAttempt<T>(
  storage: StoragePort,
  key: string,
  repair: (raw: unknown) => T | null,
): T | null {
  const raw = storage.read(key);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: unknown };
    if (parsed.state === undefined) return null;
    return repair(parsed.state);
  } catch {
    return null;
  }
}
