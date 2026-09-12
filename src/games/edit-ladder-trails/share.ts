import type { AttemptState, Puzzle } from "./types.ts";

// Spoiler-free share (REQ-017/018): a discovery-order dot grid using ONLY emoji
// (never letters). Rung finds = blue, spangram = yellow, filler = green, hint
// spends = 💡. Carries a semver encoding version (NFR-007). The share body must
// contain NO A-Z characters (REQ-018 / RISK-003) — enforced by isSpoilerSafe.

export const SHARE_ENCODING_VERSION = "1.0.0";

const SYM = {
  found_rung: "🔵",
  found_spangram: "🟡",
  found_filler: "🟢",
  spend_hint: "💡",
} as const;

export function buildShareText(state: AttemptState, dayId: string): string {
  const status = state.status === "won" ? "solved" : "…";
  const rungs = state.log.filter((e) => e.type === "found_rung").length;
  const gotSpan = state.log.some((e) => e.type === "found_spangram");
  const hints = state.hintsSpent;
  // discovery-order ribbon of emoji (spoiler-free)
  const ribbon = state.log.map((e) => SYM[e.type]).join("");
  // header carries version + counts, never letters
  const head = `Edit-Ladder Trails ${dayId} v${SHARE_ENCODING_VERSION} ${status} ${rungs}/4🔵 ${gotSpan ? "🟡" : "▫️"} ${hints}💡`;
  return `${head}\n${ribbon}`;
}

/** REQ-018 — the share body (everything after the version header line) must be
 *  free of A-Z so no grid letters or words can leak. The fixed title "Edit-Ladder
 *  Trails" is the only allowed alphabetic text and lives in the header. */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const lines = shareText.split("\n");
  const body = lines.slice(1).join("\n"); // ribbon line(s) only
  if (/[A-Za-z]/.test(body)) return false;
  // Defence-in-depth: no answer word appears anywhere.
  const upper = shareText.toUpperCase();
  for (const a of puzzle.answers) if (upper.includes(a.word.toUpperCase())) return false;
  return true;
}
