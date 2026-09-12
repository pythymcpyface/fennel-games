import type { AuditResult, Puzzle } from "./types.ts";

// REQ-017 — spoiler-safe share (TERM-028). Per-entry correctness grid + score.
// FIELD-026: MUST NOT contain any clue, displayed answer, or true answer text.

const RIGHT_GLYPH = "🟩"; // judged correctly (flag matched ground truth)
const WRONG_GLYPH = "⬛"; // misjudged

/**
 * Build shareable text:
 *   Fault Lines <dayId> <score> (<correct>/<faults> faults)
 *   🟩🟩⬛🟩...
 * Reveals only per-entry judgment correctness, never answers or clues.
 */
export function buildShareText(result: AuditResult, puzzle: Puzzle, dayId: string): string {
  const header = `Fault Lines ${dayId} ${result.score >= 0 ? "+" : ""}${result.score} (${result.correctFlags}/${puzzle.faultCount} faults)`;
  const grid = result.correctnessByEntry.map((ok) => (ok ? RIGHT_GLYPH : WRONG_GLYPH)).join("");
  return `${header}\n${grid}`;
}

/**
 * REQ-017/EDGE-010 spoiler check: the share text must not contain any displayed
 * answer from the puzzle (case- and whitespace-insensitive). Answers are the only
 * puzzle words present at runtime (true answers aren't shipped).
 */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const haystack = shareText.toUpperCase().replace(/\s+/g, "");
  return !puzzle.entries.some((e) => {
    const a = e.displayedAnswer.toUpperCase().replace(/\s+/g, "");
    return a.length > 0 && haystack.includes(a);
  });
}
