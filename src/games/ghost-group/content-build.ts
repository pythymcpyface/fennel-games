import type { Puzzle } from "./types.ts";
import { BOARD_SIZE, GROUP_SIZE } from "./types.ts";

// Build-time content generation + fairness gate for Ghost Group. Pure + deterministic.

/**
 * Fairness gate: exactly 4 categories, each with GROUP_SIZE distinct word indices,
 * disjoint, covering all BOARD_SIZE words; exactly one ghost; the ghost's correct
 * label is present among the candidates.
 */
export function isFairPuzzle(p: Puzzle): boolean {
  if (p.words.length !== BOARD_SIZE) return false;
  if (new Set(p.words.map((w) => w.toUpperCase())).size !== BOARD_SIZE) return false;
  if (p.categories.length !== 4) return false;
  if (p.categories.filter((c) => c.isGhost).length !== 1) return false;

  const seen = new Set<number>();
  for (const c of p.categories) {
    if (c.wordIdx.length !== GROUP_SIZE) return false;
    if (new Set(c.wordIdx).size !== GROUP_SIZE) return false;
    for (const idx of c.wordIdx) {
      if (idx < 0 || idx >= BOARD_SIZE) return false;
      if (seen.has(idx)) return false; // not disjoint
      seen.add(idx);
    }
  }
  if (seen.size !== BOARD_SIZE) return false; // must cover all

  const ghost = p.categories.find((c) => c.isGhost)!;
  if (!p.ghostCandidates.includes(ghost.label)) return false;
  if (new Set(p.ghostCandidates).size !== p.ghostCandidates.length) return false;
  if (p.ghostCandidates.length < 3) return false;
  return true;
}

/**
 * Build a puzzle from 4 labeled groups (each: label + 4 words) + a chosen ghost
 * index + ghost label candidates. Words are flattened into a 16-word board.
 */
export function buildPuzzle(
  groups: Array<{ label: string; words: string[] }>,
  ghostIndex: number,
  ghostCandidates: string[],
  puzzleId: string,
  order: (n: number) => number[],
): Puzzle | null {
  if (groups.length !== 4) return null;
  const words: string[] = [];
  const cats = groups.map((g, gi) => {
    const idxs: number[] = [];
    for (const w of g.words) {
      idxs.push(words.length);
      words.push(w.toUpperCase());
    }
    return { id: `cat-${gi}`, label: g.label, wordIdx: idxs, isGhost: gi === ghostIndex };
  });
  // Scramble display order: build a permutation of 0..15 and remap indices.
  const perm = order(BOARD_SIZE); // perm[displayPos] = originalIndex
  const posOf = new Array(BOARD_SIZE).fill(-1);
  perm.forEach((orig, disp) => { posOf[orig] = disp; });
  const displayWords = perm.map((orig) => words[orig]);
  const remapped = cats.map((c) => ({ ...c, wordIdx: c.wordIdx.map((i) => posOf[i]) }));

  const puzzle: Puzzle = {
    puzzleId,
    words: displayWords,
    categories: remapped,
    ghostCandidates: [...ghostCandidates],
  };
  return isFairPuzzle(puzzle) ? puzzle : null;
}

export function assertPuzzleValid(p: Puzzle): void {
  if (!isFairPuzzle(p)) throw new Error(`ghost-group ${p.puzzleId}: unfair puzzle`);
}
