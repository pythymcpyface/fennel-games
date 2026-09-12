import type { Puzzle } from "./types.ts";

// Build-time content generation + fairness gate for Cascade Type (TERM-022). Pure +
// deterministic. Validates: >=1 row, each row non-empty, all words real dictionary
// words, all words distinct across the whole cascade.

export interface RawPuzzle {
  rows: string[][];
}

/** Fairness gate (REQ-026..030). Returns failure reasons; empty = fair. */
export function validate(raw: RawPuzzle, dictionary: ReadonlySet<string>): string[] {
  const reasons: string[] = [];
  if (raw.rows.length < 1) reasons.push("puzzle has no rows");

  const seen = new Set<string>();
  raw.rows.forEach((row, r) => {
    if (row.length < 1) reasons.push(`row ${r} is empty`);
    row.forEach((word, i) => {
      const w = word.toLowerCase();
      if (!/^[a-z]+$/.test(w)) reasons.push(`row ${r} word ${i} "${word}" must be letters only`);
      if (seen.has(w)) reasons.push(`duplicate word "${w}" across the cascade`);
      seen.add(w);
      if (!dictionary.has(w)) reasons.push(`word "${w}" not in dictionary`);
    });
  });
  return reasons;
}

export function buildPuzzle(puzzleId: string, raw: RawPuzzle, dictionary: ReadonlySet<string>): Puzzle | null {
  if (validate(raw, dictionary).length > 0) return null;
  return { puzzleId, rows: raw.rows.map((row) => row.map((w) => w.toLowerCase())) };
}

export function assertPuzzleValid(raw: RawPuzzle, dictionary: ReadonlySet<string>): void {
  const reasons = validate(raw, dictionary);
  if (reasons.length > 0) throw new Error(`cascade-type invalid puzzle:\n - ${reasons.join("\n - ")}`);
}
