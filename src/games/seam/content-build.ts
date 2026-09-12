import type { Puzzle } from "./types.ts";
import { countCorrectLinks, linkKey } from "./engine.ts";

// Build-time content generation + fairness gate for Seam. Pure + deterministic.
// A chain of words is defined by an ordered list; the valid links are its
// consecutive pairs. The gate guarantees the solution ordering is UNIQUE up to
// full reversal (TERM-011/016) so the puzzle is decisive.

/** All valid undirected links for a chain given as word strings in solved order. */
export function chainLinks(chainWords: string[]): Set<string> {
  const links = new Set<string>();
  for (let i = 0; i < chainWords.length - 1; i++) links.add(`${i}-${i + 1}`);
  return links;
}

/** Enumerate all permutations of 0..n-1 (n small, <= 8). */
export function permutations(n: number): number[][] {
  if (n <= 1) return [[0].slice(0, n)];
  const out: number[][] = [];
  const rec = (cur: number[], rest: number[]): void => {
    if (rest.length === 0) {
      out.push(cur);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      rec([...cur, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]);
    }
  };
  rec([], Array.from({ length: n }, (_, i) => i));
  return out;
}

/**
 * Fairness gate: given the intended solved order of words and the set of valid
 * links (as index pairs over the solved order), verify that ONLY the solved order
 * and its reverse achieve all N-1 links. Returns true if unique up to reversal.
 */
export function isUniqueUpToReversal(n: number, validLinks: ReadonlySet<string>): boolean {
  const full = n - 1;
  const perfect: string[] = [];
  for (const perm of permutations(n)) {
    if (countCorrectLinks(perm, validLinks) === full) {
      perfect.push(perm.join(","));
    }
  }
  // Exactly the identity [0..n-1] and its reverse should be perfect.
  const identity = Array.from({ length: n }, (_, i) => i);
  const rev = [...identity].reverse();
  const allowed = new Set([identity.join(","), rev.join(",")]);
  if (perfect.length !== allowed.size) return false;
  return perfect.every((p) => allowed.has(p));
}

/**
 * Build a validated puzzle from a chain (words in solved order). The valid links
 * are exactly the consecutive pairs; the display words are scrambled deterministically
 * and the solution recorded as indices into the scrambled array.
 */
export function buildPuzzle(chainWords: string[], puzzleId: string, scramble: (n: number) => number[]): Puzzle | null {
  const n = chainWords.length;
  const words = chainWords.map((w) => w.toUpperCase());
  // Links over the SOLVED order indices.
  const solvedLinks = new Set<string>();
  for (let i = 0; i < n - 1; i++) solvedLinks.add(linkKey(i, i + 1));
  if (!isUniqueUpToReversal(n, solvedLinks)) return null;

  // Scramble display order: perm maps displayPos -> solvedIndex.
  const perm = scramble(n);
  const display = perm.map((solvedIdx) => words[solvedIdx]);
  // solution as indices into `display` that reconstruct solved order 0..n-1:
  // displayPosOf[solvedIdx] = position in display holding that solved word.
  const displayPosOf = new Array(n).fill(-1);
  perm.forEach((solvedIdx, displayPos) => {
    displayPosOf[solvedIdx] = displayPos;
  });
  const solution = Array.from({ length: n }, (_, solvedIdx) => displayPosOf[solvedIdx]);
  return { puzzleId, words: display, solution };
}

/** Gate assertion for an emitted puzzle: solution is a permutation and links unique. */
export function assertPuzzleValid(p: Puzzle): void {
  const n = p.words.length;
  const seen = new Set(p.solution);
  if (seen.size !== n) throw new Error(`solution not a permutation for ${p.puzzleId}`);
  // Valid links are the solution's consecutive display-index pairs (undirected).
  const links = new Set<string>();
  for (let i = 0; i < p.solution.length - 1; i++) links.add(linkKey(p.solution[i], p.solution[i + 1]));
  // Among ALL orderings of display positions, only the solution and its reverse
  // may achieve all N-1 links.
  const full = n - 1;
  const perfect: string[] = [];
  for (const perm of permutations(n)) {
    if (countCorrectLinks(perm, links) === full) perfect.push(perm.join(","));
  }
  const allowed = new Set([p.solution.join(","), [...p.solution].reverse().join(",")]);
  if (perfect.length !== allowed.size || !perfect.every((x) => allowed.has(x))) {
    throw new Error(`solution not unique up to reversal for ${p.puzzleId}`);
  }
}
