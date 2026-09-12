import type { DayBoundaryRule } from "./types.ts";

// Deterministic daily selection (TERM-017/018). Pure functions only — no clock,
// no storage. All cross-platform determinism (NFR-002) lives here and is verified
// by golden vectors. Integer-only arithmetic; no floating point.

/**
 * REQ-001 — canonicalize a unix-ms instant to a `YYYY-MM-DD` dayId.
 * Boundary rule is UTC (documented single rule; RISK-006 resolution).
 */
export function canonicalizeDayId(timestampMs: number, rule: DayBoundaryRule): string {
  if (!Number.isFinite(timestampMs)) {
    throw new Error(`Invalid clock value: ${timestampMs}`);
  }
  if (rule !== "UTC") {
    throw new Error(`Unsupported day-boundary rule: ${rule}`);
  }
  const d = new Date(timestampMs);
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * FNV-1a 32-bit hash over the UTF-8 code units of `input`. Deterministic and
 * integer-only, so identical on every JS engine (TERM-018). Returns an unsigned
 * 32-bit integer.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i) & 0xff;
    // 32-bit FNV prime multiply via shifts to stay in integer range.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/** Canonical seed string for daily selection. Order + separators are locked. */
export function selectionSeed(dayId: string, packVersion: string, dictionaryId: string): string {
  return `${dayId}|${packVersion}|${dictionaryId}`;
}

/**
 * REQ-002 — deterministically map (dayId, packVersion, dictionaryId) to a puzzleId.
 * The puzzle index is `hash % puzzleCount`; the id is a zero-padded `puz-NNNN`
 * token. Freezing selection per packVersion keeps historical days stable (RISK-002).
 */
export function derivePuzzleId(
  dayId: string,
  packVersion: string,
  dictionaryId: string,
  puzzleCount: number,
): string {
  if (!Number.isInteger(puzzleCount) || puzzleCount <= 0) {
    throw new Error(`puzzleCount must be a positive integer, got ${puzzleCount}`);
  }
  const h = fnv1a32(selectionSeed(dayId, packVersion, dictionaryId));
  const index = h % puzzleCount;
  return `puz-${index.toString().padStart(4, "0")}`;
}
