import type { AttemptState, Cluster, Puzzle } from "./types.ts";

// Spoiler-free share (no letters, no anchors). Discovery-order ribbon: cluster A
// finds = 🔵, cluster B = 🟣, spangram = 🟡, filler = 🟢, hint spend = 💡.

export const SHARE_ENCODING_VERSION = "1.0.0";

const CLUSTER_SQUARE: Record<Cluster, string> = { A: "🔵", B: "🟣" };

export function buildShareText(state: AttemptState, dayId: string): string {
  const status = state.status === "won" ? "solved" : "…";
  const themes = state.log.filter((e) => e.type === "found_theme").length;
  const gotSpan = state.log.some((e) => e.type === "found_spangram");
  const ribbon = state.log.map((e) => {
    if (e.type === "found_theme" && e.cluster) return CLUSTER_SQUARE[e.cluster];
    if (e.type === "found_spangram") return "🟡";
    if (e.type === "found_filler") return "🟢";
    return "💡";
  }).join("");
  const head = `Semantic Constellation ${dayId} v${SHARE_ENCODING_VERSION} ${status} ${themes}/4 ${gotSpan ? "🟡" : "▫️"} ${state.hintsSpent}💡`;
  return `${head}\n${ribbon}`;
}

/** No A-Z in the ribbon body; no answer/anchor word anywhere. */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const body = shareText.split("\n").slice(1).join("\n");
  if (/[A-Za-z]/.test(body)) return false;
  const upper = shareText.toUpperCase();
  for (const a of puzzle.answers) if (upper.includes(a.word.toUpperCase())) return false;
  for (const anchor of [puzzle.anchorA, puzzle.anchorB]) if (anchor && upper.includes(anchor.toUpperCase())) return false;
  return true;
}
