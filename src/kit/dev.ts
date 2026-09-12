import { derivePuzzleId } from "./selection.ts";

// Dev-mode puzzle override (TERM-DEV). Lets a developer force a specific daily
// puzzle — e.g. to preview a particular start word — without changing the clock.
//
// Activation is opt-in and never affects production users:
//   * enable dev mode with `?dev=1` in the URL (persisted), or storage flag; and
//   * pick a puzzle via `?puzzle=<gameId>:<indexOrWord>` in the URL, or the
//     per-game storage key `fennel-games:v1:<gameId>:dev:puzzle`.
//
// When no override applies, resolution is identical to the normal deterministic
// daily selection (derivePuzzleId), so behaviour is unchanged by default.

const DEV_FLAG_KEY = "fennel-games:v1:dev:enabled";

export interface DevReader {
  /** raw storage read (namespaced key). */
  read(key: string): string | null;
  /** current location hash/search (injectable for tests). */
  locationSearch?: string;
}

/** True if dev mode is on: URL `?dev=1`/`#…?dev=1` or a persisted storage flag. */
export function isDevMode(reader: DevReader): boolean {
  const search = reader.locationSearch ?? (typeof window !== "undefined" ? window.location.href : "");
  if (/[?&#]dev=1\b/.test(search)) return true;
  return reader.read(DEV_FLAG_KEY) === "1";
}

/** Persist the dev-mode flag (so it survives navigation once toggled by `?dev=1`). */
export function setDevMode(write: (k: string, v: string) => void, on: boolean): void {
  write(DEV_FLAG_KEY, on ? "1" : "0");
}

/**
 * Storage key holding a per-game dev puzzle override. The value is either a
 * numeric index (`"12"`) or a target word/token (`"ocean"`) — the plugin decides
 * how to interpret a non-numeric value against its own puzzle list.
 */
export function devOverrideKey(gameId: string): string {
  return `fennel-games:v1:${gameId}:dev:puzzle`;
}

/**
 * Read a raw dev override for a game (index or word), or null. Checks the URL
 * (`?puzzle=<gameId>:<value>`) first, then the per-game storage key.
 */
export function readDevOverride(gameId: string, reader: DevReader): string | null {
  if (!isDevMode(reader)) return null;
  const search = reader.locationSearch ?? (typeof window !== "undefined" ? window.location.href : "");
  const m = search.match(/[?&#]puzzle=([a-z0-9-]+):([^&#]+)/i);
  if (m && m[1] === gameId) return decodeURIComponent(m[2]);
  return reader.read(devOverrideKey(gameId));
}

/**
 * Resolve the puzzle index for a game. Returns the normal deterministic daily
 * index unless a dev override is active and valid.
 *
 * @param resolveByWord optional: given the override string, return an index (or
 *   -1 if not found). Used when a game wants to accept a start WORD rather than an
 *   index. If omitted, only numeric overrides apply.
 */
export function resolveDailyPuzzleIndex(
  gameId: string,
  dayId: string,
  packVersion: string,
  datasetId: string,
  puzzleCount: number,
  reader: DevReader,
  resolveByWord?: (override: string) => number,
): number {
  const normalId = derivePuzzleId(dayId, packVersion, datasetId, puzzleCount);
  const normalIndex = Number(normalId.slice(4));
  const override = readDevOverride(gameId, reader);
  if (override === null || override.trim() === "") return normalIndex;

  const trimmed = override.trim();
  if (/^\d+$/.test(trimmed)) {
    const idx = Number(trimmed);
    if (Number.isInteger(idx) && idx >= 0 && idx < puzzleCount) return idx;
    return normalIndex;
  }
  if (resolveByWord) {
    const idx = resolveByWord(trimmed);
    if (Number.isInteger(idx) && idx >= 0 && idx < puzzleCount) return idx;
  }
  return normalIndex;
}
