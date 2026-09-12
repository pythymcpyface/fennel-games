import type { Puzzle } from "./types.ts";

// Build-time content generation + fairness gate (TERM-011, JOURNEY-007). Pure.
// Input: a sense-tagged lexicon mapping word -> set of category ids.

export type Lexicon = Record<string, string[]>; // word -> categories

export interface CandidateSet {
  words: string[]; // 5 words
  themeCategory: string;
  oddWord: string;
}

/**
 * REQ-023/024 — validate a candidate: exactly 4 words share themeCategory, exactly 1
 * (the odd) does NOT, and no OTHER single category is shared by 4+ words (which would
 * make more than one word "odd" under an alternate reading). Deterministic.
 */
export function isFairSet(cand: CandidateSet, lexicon: Lexicon): boolean {
  const { words, themeCategory, oddWord } = cand;
  if (words.length !== 5) return false;
  if (new Set(words).size !== 5) return false;
  if (!words.includes(oddWord)) return false;

  const themed = words.filter((w) => w !== oddWord);
  // All 4 themed words must have the theme category; odd must NOT.
  if (!themed.every((w) => (lexicon[w] ?? []).includes(themeCategory))) return false;
  if ((lexicon[oddWord] ?? []).includes(themeCategory)) return false;

  // No alternative category may be shared by 4+ of the 5 words (ambiguity guard).
  const catCounts = new Map<string, number>();
  for (const w of words) {
    for (const c of lexicon[w] ?? []) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  }
  for (const [cat, count] of catCounts) {
    if (cat === themeCategory) continue;
    if (count >= 5) return false; // a category shared by ALL 5 => theme is ambiguous
  }
  return true;
}

/** Choose the deterministic hint elimination: lowest-index themed (non-odd) word. */
export function hintIndexFor(words: string[], oddWordIndex: number): number {
  for (let i = 0; i < words.length; i++) if (i !== oddWordIndex) return i;
  return -1;
}

/** Assemble a validated Puzzle from a fair candidate (words kept in given order). */
export function buildPuzzle(
  puzzleId: string,
  cand: CandidateSet,
  themeLabel: string,
  oddCategoryLabel: string,
): Puzzle {
  const oddWordIndex = cand.words.indexOf(cand.oddWord);
  return {
    puzzleId,
    words: cand.words.map((w) => w.toUpperCase()),
    oddWordIndex,
    themeLabel,
    oddCategoryLabel,
    hintEliminationIndex: hintIndexFor(cand.words, oddWordIndex),
  };
}

/** Build all valid puzzles from labeled candidates, applying the gate. */
export function buildPuzzles(
  candidates: { cand: CandidateSet; themeLabel: string; oddCategoryLabel: string }[],
  lexicon: Lexicon,
): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isFairSet(c.cand, lexicon)) continue;
    out.push(buildPuzzle("", c.cand, c.themeLabel, c.oddCategoryLabel));
  }
  out.sort((a, b) => (a.words.join() < b.words.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

/** Gate assertion for emitted puzzles. */
export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    if (p.words.length !== 5) throw new Error(`${p.puzzleId}: not 5 words`);
    if (p.oddWordIndex < 0 || p.oddWordIndex > 4) throw new Error(`${p.puzzleId}: bad odd index`);
    if (p.hintEliminationIndex === p.oddWordIndex) throw new Error(`${p.puzzleId}: hint eliminates odd`);
  }
}
