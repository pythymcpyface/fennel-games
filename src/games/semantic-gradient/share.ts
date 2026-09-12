import type { AttemptState, Band, Puzzle } from "./types.ts";

// Spoiler-free share (no letters, no anchor). Discovery-order ribbon: theme finds
// render as their closeness band square (🔴 hot → 🔵 cold), spangram = 🟡, filler
// = 🟢, hint spend = 💡. Semver header (no A-Z leak in the ribbon body).

export const SHARE_ENCODING_VERSION = "1.0.0";

const BAND_SQUARE: Record<Band, string> = { hot: "🔴", warm: "🟠", cool: "🔵", cold: "🟦" };

export function buildShareText(state: AttemptState, dayId: string): string {
  const status = state.status === "won" ? "solved" : "…";
  const themes = state.log.filter((e) => e.type === "found_theme").length;
  const gotSpan = state.log.some((e) => e.type === "found_spangram");
  const ribbon = state.log.map((e) => {
    if (e.type === "found_theme" && e.band) return BAND_SQUARE[e.band];
    if (e.type === "found_spangram") return "🟡";
    if (e.type === "found_filler") return "🟢";
    return "💡";
  }).join("");
  const head = `Semantic Gradient ${dayId} v${SHARE_ENCODING_VERSION} ${status} ${themes}/4 ${gotSpan ? "🟡" : "▫️"} ${state.hintsSpent}💡`;
  return `${head}\n${ribbon}`;
}

/** REQ-017 — no A-Z in the ribbon body; no answer/anchor word anywhere. */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const body = shareText.split("\n").slice(1).join("\n");
  if (/[A-Za-z]/.test(body)) return false;
  const upper = shareText.toUpperCase();
  for (const a of puzzle.answers) if (upper.includes(a.word.toUpperCase())) return false;
  if (puzzle.anchor && upper.includes(puzzle.anchor.toUpperCase())) return false;
  return true;
}
