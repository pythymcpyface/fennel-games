// Spoiler-safe Word Morph share text (never leaks intermediate words). Ported
// from the standalone app's engine/share.ts, hub-shaped.

export function buildShareText(dayId: string, moveCount: number, par: number): string {
  const beat = moveCount <= par ? " ✨" : "";
  const grid = "🟩".repeat(Math.max(1, moveCount));
  return `Word Morph ${dayId}\n${moveCount}/${par}${beat}\n${grid}`;
}

/** No intermediate/target word ever appears in the share text, so it is always
 * spoiler-safe by construction. Kept for parity with other games' share guards. */
export function isSpoilerSafe(_text: string): boolean {
  return true;
}
