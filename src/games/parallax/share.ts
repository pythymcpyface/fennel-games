import type { AttemptState } from "./types.ts";
import { CLOSENESS_MAX, GUESS_BUDGET } from "./types.ts";

// REQ-018/019 — spoiler-safe share (TERM-025). Encodes only closeness band per row
// as a coarse block; never prints guesses, anchors, or the target.

function blockFor(closeness: number): string {
  if (closeness >= CLOSENESS_MAX) return "⭐";
  if (closeness >= 6) return "🟩";
  if (closeness >= 3) return "🟨";
  return "⬛";
}

/**
 * Build shareable text:
 *   Parallax <dayId> <guesses>/12
 *   <one block per guess row>
 * Rows encode only the closeness tier (spoiler-safe): no words.
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const score = state.isSolved ? String(state.rows.length) : "X";
  const header = `Parallax ${dayId} ${score}/${GUESS_BUDGET}`;
  const rows = state.rows.map((r) => blockFor(r.closeness)).join("");
  return `${header}\n${rows}`;
}

/** REQ-018 spoiler check: must not contain anchors, target, or any guess. */
export function isSpoilerSafe(shareText: string, secret: string[], guesses: string[]): boolean {
  const up = shareText.toUpperCase();
  return ![...secret, ...guesses].some((w) => w && up.includes(w.toUpperCase()));
}
