import type { AttemptState, Puzzle } from "./types.ts";
import { outcomeTier, lockedCount } from "./engine.ts";

// REQ-016/017 — spoiler-safe share (TERM-019). Per-word outcome grid + lock count.
// FIELD-026/027: MUST NOT contain any target word or letters.

const TIER_GLYPH: Record<string, string> = {
  HIGH_LOCK: "🟩",
  LOW_LOCK: "🟨",
  LOST: "⬛",
  UNLOCKED: "⬜",
};

/**
 * Build shareable text:
 *   Decay <dayId> <locked>/<total>
 *   🟩🟨⬛🟩...
 * Reveals only per-word outcome tiers and the lock count.
 */
export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const total = puzzle.targets.length;
  const locked = lockedCount(state);
  const header = `Decay ${dayId} ${locked}/${total}`;
  const grid = puzzle.targets.map((_t, i) => TIER_GLYPH[outcomeTier(state, puzzle, i)]).join("");
  return `${header}\n${grid}`;
}

/**
 * REQ-017/EDGE-005 spoiler check: the share must not contain any target word.
 */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const hay = shareText.toUpperCase();
  return !puzzle.targets.some((t) => {
    const w = t.word.toUpperCase();
    return w.length >= 2 && hay.includes(w);
  });
}
