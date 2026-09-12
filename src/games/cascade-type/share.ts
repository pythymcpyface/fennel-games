import type { AttemptState, Band, Puzzle } from "./types.ts";
import { clearedFraction } from "./engine.ts";

// REQ-022/024/025 — spoiler-safe share (TERM-024). Score band + combo band +
// cleared-fraction bar. FIELD-024: MUST NOT contain any puzzle word.

/** FIELD-025 — score band from thresholds. */
export function scoreBand(score: number): Band {
  if (score >= 80) return "S";
  if (score >= 50) return "A";
  if (score >= 30) return "B";
  if (score >= 15) return "C";
  return "D";
}

/** FIELD-026 — max-combo band from thresholds. */
export function comboBand(comboMax: number): Band {
  if (comboMax >= 8) return "S";
  if (comboMax >= 5) return "A";
  if (comboMax >= 3) return "B";
  if (comboMax >= 1) return "C";
  return "D";
}

const FILLED = "🟩";
const EMPTY = "⬜";

/**
 * Build shareable text:
 *   Cascade Type <dayId> <score band>/<combo band>
 *   🟩🟩🟩⬜⬜  (5-cell cleared-fraction bar)
 * Reveals only bands + progress bar, never words.
 */
export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const sBand = scoreBand(state.score);
  const cBand = comboBand(state.comboMax);
  const frac = clearedFraction(state, puzzle);
  const filled = Math.round(frac * 5);
  const bar = FILLED.repeat(filled) + EMPTY.repeat(5 - filled);
  return `Cascade Type ${dayId} ${sBand}·combo ${cBand}\n${bar}`;
}

/**
 * REQ-022/ERROR-004 spoiler check: the share text must not contain any puzzle
 * word (case-insensitive).
 */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const hay = shareText.toUpperCase();
  for (const row of puzzle.rows) {
    for (const w of row) {
      const up = w.toUpperCase();
      if (up.length >= 2 && hay.includes(up)) return false;
    }
  }
  return true;
}
