import type { AttemptState } from "./types.ts";

// REQ-014 — spoiler-safe share (TERM-016). Per-submission outcome squares; no words/labels.

/**
 * Build shareable text:
 *   GG <dayId> <status>
 *   <one square per submission: 🟩 correct group / 🟥 mistake> + ghost marker
 * Uses a short "GG" title so the fixed header can never collide with a puzzle
 * label during the spoiler check.
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const status = state.playState === "won" ? "solved" : state.playState === "lost" ? "X" : "…";
  const header = `GG ${dayId} ${status}`;
  const rows = state.history.map((ok) => (ok ? "🟩" : "🟥")).join("");
  const ghost = state.ghostCorrect === true ? " 👻+" : state.ghostCorrect === false ? " 👻-" : "";
  return `${header}\n${rows}${ghost}`;
}

/** REQ-014 spoiler check: must contain no board word or category label. */
export function isSpoilerSafe(shareText: string, words: string[], labels: string[]): boolean {
  const up = shareText.toUpperCase();
  return ![...words, ...labels].some((s) => s && s.length >= 3 && up.includes(s.toUpperCase()));
}
