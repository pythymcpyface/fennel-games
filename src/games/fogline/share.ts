import type { AttemptState, Puzzle } from "./types.ts";

// REQ-012 — spoiler-safe share (TERM-026). Per-target found/missed grid + count.
// FIELD-031: MUST NOT contain any target word or grid letters.

const FOUND_GLYPH = "🟩";
const MISSED_GLYPH = "⬛";

/**
 * Build shareable text:
 *   Fogline <dayId> <found>/<total> · <selections> selections
 *   🟩🟩⬛...
 * Reveals only which targets were found and the selection count.
 */
export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const total = puzzle.targets.length;
  const found = state.foundTargetIds.length;
  const header = `Fogline ${dayId} ${found}/${total} · ${state.selectionCount} selection${state.selectionCount === 1 ? "" : "s"}`;
  const grid = puzzle.targets.map((t) => (state.foundTargetIds.includes(t.id) ? FOUND_GLYPH : MISSED_GLYPH)).join("");
  return `${header}\n${grid}`;
}

/**
 * REQ-012/ERROR-004 spoiler check: the share text must not contain any target
 * word (case- and whitespace-insensitive).
 */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const haystack = shareText.toUpperCase().replace(/\s+/g, "");
  return !puzzle.targets.some((t) => {
    const w = t.word.toUpperCase().replace(/\s+/g, "");
    return w.length > 0 && haystack.includes(w);
  });
}
