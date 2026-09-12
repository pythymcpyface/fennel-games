import type { DecodeResult, ProgressBand } from "./types.ts";

// REQ-011/012 — spoiler-safe share (TERM-014). Progress band + solved flag.
// FIELD-015: MUST NOT contain any plaintext or ciphertext characters.

const BAND_GLYPH: Record<ProgressBand, string> = {
  B0: "⬜⬜⬜⬜⬜",
  B1: "🟦⬜⬜⬜⬜",
  B2: "🟦🟦⬜⬜⬜",
  B3: "🟦🟦🟦⬜⬜",
  B4: "🟦🟦🟦🟦⬜",
  B5: "🟩🟩🟩🟩🟩",
};

/** FIELD-013/014 — banded progress fraction. */
export function progressBand(result: DecodeResult): ProgressBand {
  if (result.total === 0) return "B0";
  const f = result.correct / result.total;
  if (result.solved || f >= 1) return "B5";
  if (f >= 0.8) return "B4";
  if (f >= 0.6) return "B3";
  if (f >= 0.4) return "B2";
  if (f >= 0.2) return "B1";
  return "B0";
}

/**
 * Build shareable text:
 *   Cipher Diary <dayId> <solved?>
 *   🟦🟦🟦⬜⬜
 * Reveals only banded decode progress and whether solved.
 */
export function buildShareText(result: DecodeResult, dayId: string): string {
  const band = progressBand(result);
  const header = `Cipher Diary ${dayId} ${result.solved ? "🔓" : "🔒"}`;
  return `${header}\n${BAND_GLYPH[band]}`;
}

/**
 * REQ-011/NFR-004 spoiler check: the share text must contain only the fixed
 * template + emoji + the day id (digits/dashes). No decoded letters leak because
 * we never interpolate puzzle text; this guards against accidental changes.
 */
export function isSpoilerSafe(shareText: string): boolean {
  // Allow letters only within the fixed header words "Cipher Diary".
  const withoutHeader = shareText.replace(/Cipher Diary/g, "");
  return !/[A-Za-z]/.test(withoutHeader);
}
