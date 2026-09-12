import type { LetterCounts, Puzzle, TargetBucket } from "./types.ts";
import { lettersOf } from "./engine.ts";

// Build-time content generation + fairness gate for Ration. Pure + deterministic.
// The gate proves the target histogram is achievable from the inventory using a
// backtracking solver that consumes the SHARED inventory (words cannot overspend).

/** Deduct a word's letters from an inventory copy; returns null if unaffordable. */
export function spend(inventory: LetterCounts, word: string): LetterCounts | null {
  const next = { ...inventory };
  for (const [ch, n] of Object.entries(lettersOf(word))) {
    if ((next[ch] ?? 0) < n) return null;
    next[ch] -= n;
  }
  return next;
}

/**
 * Fairness gate solver: can we pick words from `candidates` (each usable once)
 * that satisfy every target bucket while never overspending `inventory`?
 * Backtracking with a node budget for termination.
 */
export function isAchievable(
  inventory: LetterCounts,
  targets: TargetBucket[],
  candidates: string[],
  nodeBudget = 200000,
): boolean {
  // Group candidates by length; only lengths we need.
  const needed = targets.filter((t) => t.count > 0).sort((a, b) => b.length - a.length);
  if (needed.length === 0) return true;
  const byLen = new Map<number, string[]>();
  for (const t of needed) byLen.set(t.length, candidates.filter((w) => w.length === t.length));
  let budget = nodeBudget;

  // Solve bucket by bucket (largest length first — most constrained).
  const solveBucket = (bi: number, inv: LetterCounts): boolean => {
    if (bi >= needed.length) return true;
    const bucket = needed[bi];
    const pool = byLen.get(bucket.length) ?? [];
    // choose `bucket.count` distinct words from pool affordable in sequence
    const chooseN = (start: number, remaining: number, curInv: LetterCounts): boolean => {
      if (budget-- <= 0) return false;
      if (remaining === 0) return solveBucket(bi + 1, curInv);
      for (let i = start; i < pool.length; i++) {
        const spent = spend(curInv, pool[i]);
        if (spent === null) continue;
        if (chooseN(i + 1, remaining - 1, spent)) return true;
      }
      return false;
    };
    return chooseN(0, bucket.count, inv);
  };

  return solveBucket(0, inventory);
}

/** Build a validated puzzle; fairness gate must confirm achievability. */
export function buildPuzzle(
  inventory: LetterCounts,
  targets: TargetBucket[],
  candidates: string[],
  puzzleId: string,
): Puzzle | null {
  const inv: LetterCounts = {};
  for (const [ch, n] of Object.entries(inventory)) inv[ch.toUpperCase()] = n;
  if (!isAchievable(inv, targets, candidates)) return null;
  return { puzzleId, inventory: inv, targets: [...targets] };
}

export function assertPuzzleValid(p: Puzzle, candidates: string[]): void {
  if (!isAchievable(p.inventory, p.targets, candidates)) {
    throw new Error(`ration ${p.puzzleId}: targets not achievable from inventory`);
  }
}
