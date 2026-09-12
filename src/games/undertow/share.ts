import type { AttemptState, Puzzle } from "./types.ts";

// REQ-016 — spoiler-safe share (TERM-020). Per-target found/missed grid + mistakes.
// FIELD-031: MUST NOT contain any target word, decoy word, or grid letters.

const FOUND_GLYPH = "🟩";
const MISSED_GLYPH = "⬛";

/**
 * Build shareable text:
 *   Undertow <dayId> <found>/<total> · <mistakes> mistakes
 *   🟩🟩⬛...
 * Reveals only which targets were found and the mistake count.
 */
export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const total = puzzle.targets.length;
  const found = state.foundTargetIds.length;
  const header = `Undertow ${dayId} ${found}/${total} · ${state.mistakeCount} mistake${state.mistakeCount === 1 ? "" : "s"}`;
  const grid = puzzle.targets.map((t) => (state.foundTargetIds.includes(t.id) ? FOUND_GLYPH : MISSED_GLYPH)).join("");
  return `${header}\n${grid}`;
}

/**
 * REQ-016/EDGE-014 spoiler check: the share text must not contain any target or
 * decoy word (case- and whitespace-insensitive).
 */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const haystack = shareText.toUpperCase().replace(/\s+/g, "");
  const words = [...puzzle.targets, ...puzzle.decoys].map((p) => p.word.toUpperCase().replace(/\s+/g, ""));
  return !words.some((w) => w.length > 0 && haystack.includes(w));
}
