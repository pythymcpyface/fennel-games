import type { Puzzle, Tile } from "./types.ts";
import { rackUsedExactly, assignTiles, normalize } from "./engine.ts";

// Build-time content generation + fairness gate for Tare (TERM-016). Pure +
// deterministic. Each puzzle ships a rack + tolerance + a guaranteed solution
// (left/right words). The gate proves the solution is valid: both words are real
// dictionary words, together consume the rack exactly, and balance within tol.

export interface RawPuzzle {
  rack: Tile[];
  tolerance: number;
  guaranteedLeft: string;
  guaranteedRight: string;
}

/** Standard letter weights (rarer letters weigh more). Deterministic. */
export const LETTER_WEIGHT: Record<string, number> = {
  E: 1, A: 1, I: 1, O: 1, N: 1, R: 1, T: 1, L: 1, S: 1, U: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
};

export function weightFor(letter: string): number {
  return LETTER_WEIGHT[letter.toUpperCase()] ?? 1;
}

/** Build a rack of weighted tiles from a letter string (deterministic ids). */
export function rackFromLetters(letters: string): Tile[] {
  return normalize(letters)
    .split("")
    .map((letter, i) => ({ id: `t${i}`, letter, weight: weightFor(letter) }));
}

/** Fairness gate (NFR-006). Returns failure reasons; empty = fair. */
export function validate(raw: RawPuzzle, dictionary: ReadonlySet<string>): string[] {
  const reasons: string[] = [];
  const L = normalize(raw.guaranteedLeft);
  const R = normalize(raw.guaranteedRight);
  if (L.length === 0 || R.length === 0) reasons.push("guaranteed words must be non-empty");
  if (!/^[A-Z]+$/.test(L)) reasons.push("left word must be A-Z");
  if (!/^[A-Z]+$/.test(R)) reasons.push("right word must be A-Z");
  if (raw.tolerance < 0) reasons.push("tolerance must be >= 0");
  if (raw.rack.some((t) => !Number.isInteger(t.weight) || t.weight < 0)) reasons.push("tile weights must be non-negative integers");
  if (new Set(raw.rack.map((t) => t.id)).size !== raw.rack.length) reasons.push("duplicate tile id");
  if (reasons.length > 0) return reasons;

  if (!dictionary.has(L)) reasons.push(`guaranteed left word "${L}" not in dictionary`);
  if (!dictionary.has(R)) reasons.push(`guaranteed right word "${R}" not in dictionary`);
  if (!rackUsedExactly(raw.rack, L, R)) reasons.push("guaranteed solution does not consume the rack exactly");

  // Balance check via the same assignment the engine uses.
  const la = assignTiles(raw.rack, L);
  if (la === null) reasons.push("cannot assign rack tiles to left word");
  else {
    const ra = assignTiles(la.remaining, R);
    if (ra === null) reasons.push("cannot assign rack tiles to right word");
    else {
      const lw = la.tiles.reduce((n, t) => n + t.weight, 0);
      const rw = ra.tiles.reduce((n, t) => n + t.weight, 0);
      if (Math.abs(lw - rw) > raw.tolerance) reasons.push(`guaranteed solution imbalance ${Math.abs(lw - rw)} exceeds tolerance ${raw.tolerance}`);
    }
  }
  return reasons;
}

export function buildPuzzle(puzzleId: string, raw: RawPuzzle, dictionary: ReadonlySet<string>): Puzzle | null {
  if (validate(raw, dictionary).length > 0) return null;
  return { puzzleId, rack: raw.rack.map((t) => ({ ...t })), tolerance: raw.tolerance };
}

export function assertPuzzleValid(raw: RawPuzzle, dictionary: ReadonlySet<string>): void {
  const reasons = validate(raw, dictionary);
  if (reasons.length > 0) throw new Error(`tare invalid puzzle:\n - ${reasons.join("\n - ")}`);
}
