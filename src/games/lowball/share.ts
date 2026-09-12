// Lowball — spoiler-safe share text.
//
// Spoiler safety is structural, not filtered: this module only ever receives the
// total, the par, the verdict, the day and the mode. No answer word is ever passed
// in, so no answer word can leak out (REQ-047). `isSpoilerSafe` exists as a
// belt-and-braces assertion the view runs before handing text to the share sheet.

import { MAX_PANEL_SCORE, SWEEPS_TOTAL, type AttemptState, type Puzzle } from "./types.ts";
import { totalFor } from "./engine.ts";

const FILLED = "🟥";
const EMPTY = "⬜";
const BAR_WIDTH = 10;

/**
 * A ten-cell bar standing in for one sweep's score. Higher score means more filled
 * cells, so a good round reads as a mostly-empty grid — the inverse of most games,
 * matching Lowball's lower-is-better scoring.
 */
export function scoreBar(panelScore: number): string {
  const clamped = Math.min(MAX_PANEL_SCORE, Math.max(0, panelScore));
  const filled = Math.round((clamped / MAX_PANEL_SCORE) * BAR_WIDTH);
  return FILLED.repeat(filled) + EMPTY.repeat(BAR_WIDTH - filled);
}

/** Sharing opens only once the round is terminal (REQ-057). */
export function canShare(state: AttemptState): boolean {
  return state.verdict !== "pending";
}

/**
 * Build the shareable summary. Reveals only the total, the par and per-sweep bars.
 */
export function buildShareText(state: AttemptState, parValue: number): string {
  const player = state.players[state.activePlayerIndex];
  const total = totalFor(player);
  const outcome = state.verdict === "win" ? `${total}/${parValue} ✅` : `${total}/${parValue} ❌`;
  const marker = state.mode === "practice" ? " (Practice)" : "";
  const bars = player.sweeps.map((s) => scoreBar(s.panelScore)).join("\n");
  const padded =
    player.sweeps.length < SWEEPS_TOTAL
      ? [bars, ...Array(SWEEPS_TOTAL - player.sweeps.length).fill(EMPTY.repeat(BAR_WIDTH))]
          .filter((line) => line !== "")
          .join("\n")
      : bars;
  return `Lowball${marker} ${state.dayId} ${outcome}\n${padded}`;
}

/**
 * Assert no answer word appears in the share text. A guard against a future edit
 * accidentally threading a word through.
 */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const a of puzzle.answers) {
    if (upper.includes(a.word.toUpperCase())) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Multiplayer share (REQ-032)
// ---------------------------------------------------------------------------

import type { MpLeaderboardEntry } from "./multiplayer-client.ts";

/**
 * Build a spoiler-safe multiplayer result summary.
 * Reveals the player's rank, round total, and the day — no answer words.
 */
export function buildMpShareText(
  board: MpLeaderboardEntry[],
  mySlotIndex: number,
  dayId: string,
): string {
  const me = board.find((e) => e.slotIndex === mySlotIndex);
  if (!me) return `Lowball MP ${dayId}`;
  const rankLabel = me.isJointWinner ? "Joint winner" : `#${me.rank}`;
  const playerCount = board.length;
  const bars = scoreBar(me.roundTotal / 2); // approximate single-bar from total (display only)
  return `Lowball MP ${dayId} ${rankLabel}/${playerCount}\nTotal: ${me.roundTotal}\n${bars}`;
}

/**
 * Assert no answer word appears in the multiplayer share text.
 * Delegates to the single-player isSpoilerSafe helper (same check).
 */
export function isMpShareSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  return isSpoilerSafe(shareText, puzzle);
}
