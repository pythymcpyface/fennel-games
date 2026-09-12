import type { AttemptState, Puzzle } from "./types.ts";
import { isSolved, stepsCount } from "./engine.ts";

// REQ-013/014 — spoiler-safe share (TERM-020). Path-shape (steps) + solved flag.
// FIELD-019/020: MUST NOT contain any prompt text or choice words.

/**
 * Build shareable text:
 *   Marginalia <dayId> <trophy/skull>
 *   🔹🔹🔹  (one node-glyph per step; 🏆 if golden)
 * Reveals only the number of choices made and whether the golden ending was hit.
 */
export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const solved = isSolved(state, puzzle);
  const steps = stepsCount(state);
  const header = `Marginalia ${dayId} ${solved ? "🏆" : "📖"}`;
  const path = "🔹".repeat(steps) + (solved ? "✨" : "");
  return `${header}\n${path || "—"}`;
}

/**
 * REQ-014/EDGE-007 spoiler check: the share text must not contain any prompt or
 * choice word from the puzzle (case-insensitive substring).
 */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const hay = shareText.toUpperCase();
  for (const node of Object.values(puzzle.nodes)) {
    for (const c of node.choices) {
      const w = c.word.trim().toUpperCase();
      if (w.length >= 2 && hay.includes(w)) return false;
    }
  }
  return true;
}
