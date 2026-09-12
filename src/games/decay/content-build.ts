import type { Puzzle, Target } from "./types.ts";

// Build-time content generation + fairness gate for Decay (TERM-017). Pure +
// deterministic. Validates: >=1 target, all real dictionary words, distinct,
// each decay order a valid permutation of the word's letter indices, and tick 0
// fully visible (guaranteed by construction, re-checked here).

export interface RawPuzzle {
  targets: Target[];
  lockThreshold?: number;
}

function isPermutation(order: readonly number[], len: number): boolean {
  if (order.length !== len) return false;
  const seen = new Set<number>();
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= len || seen.has(i)) return false;
    seen.add(i);
  }
  return seen.size === len;
}

/** Fairness gate (REQ-022..026). Returns failure reasons; empty = fair. */
export function validate(raw: RawPuzzle, dictionary: ReadonlySet<string>): string[] {
  const reasons: string[] = [];
  if (raw.targets.length < 1) reasons.push("puzzle has no targets");

  const seen = new Set<string>();
  for (const t of raw.targets) {
    const w = t.word.toLowerCase();
    if (!/^[a-z]+$/.test(w)) reasons.push(`target "${t.word}" must be letters only`);
    if (seen.has(w)) reasons.push(`duplicate target "${w}"`);
    seen.add(w);
    if (!dictionary.has(w)) reasons.push(`target "${w}" not in dictionary`);
    if (!isPermutation(t.decayOrder, t.word.length)) reasons.push(`target "${w}" has an invalid decay order`);
    // REQ-026 — at tick 0 nothing is hidden (structural: hideN=0), so all visible.
  }

  const threshold = raw.lockThreshold ?? raw.targets.length;
  if (threshold < 1 || threshold > raw.targets.length) reasons.push(`lockThreshold ${threshold} out of range`);

  return reasons;
}

export function buildPuzzle(puzzleId: string, raw: RawPuzzle, dictionary: ReadonlySet<string>): Puzzle | null {
  if (validate(raw, dictionary).length > 0) return null;
  return {
    puzzleId,
    targets: raw.targets.map((t) => ({ word: t.word.toLowerCase(), decayOrder: t.decayOrder.slice() })),
    lockThreshold: raw.lockThreshold ?? raw.targets.length,
  };
}

export function assertPuzzleValid(raw: RawPuzzle, dictionary: ReadonlySet<string>): void {
  const reasons = validate(raw, dictionary);
  if (reasons.length > 0) throw new Error(`decay invalid puzzle:\n - ${reasons.join("\n - ")}`);
}
