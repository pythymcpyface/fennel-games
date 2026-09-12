import type { AttemptState, TargetBucket } from "./types.ts";
import { coverage } from "./engine.ts";

// REQ-021/022 — spoiler-safe share (TERM-021). Target-coverage blocks; no words.

/**
 * Build shareable text:
 *   Ration <dayId> <status>
 *   L<len>: <met>/<req> per target bucket, as filled/empty squares.
 */
export function buildShareText(state: AttemptState, targets: TargetBucket[], dayId: string): string {
  const status = state.isComplete ? "solved" : "…";
  const header = `Ration ${dayId} ${status}`;
  const cov = coverage(state.words, targets);
  const rows = targets
    .slice()
    .sort((a, b) => a.length - b.length)
    .map((t) => {
      const met = cov[t.length] ?? 0;
      return `${t.length}: ${"🟩".repeat(met)}${"⬛".repeat(Math.max(0, t.count - met))}`;
    })
    .join("\n");
  return `${header}\n${rows}`;
}

/** REQ-022 spoiler check: must not contain any submitted word. */
export function isSpoilerSafe(shareText: string, words: string[]): boolean {
  const up = shareText.toUpperCase();
  return !words.some((w) => w && up.includes(w.toUpperCase()));
}
