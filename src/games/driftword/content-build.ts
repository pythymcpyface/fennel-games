import type { Puzzle } from "./types.ts";
import { WORD_LEN } from "./types.ts";

// Build-time content generation + fairness gate for Driftword. Pure + deterministic.
// A puzzle is a word-ladder path; the gate proves each consecutive pair differs by
// exactly one letter and every word is a real dictionary word.

/** Number of positions at which two equal-length words differ. */
export function letterDiff(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

/** A path is a valid ladder if consecutive words differ by exactly one letter. */
export function isValidLadder(path: string[]): boolean {
  if (path.length < 2) return false;
  for (let i = 1; i < path.length; i++) {
    if (path[i].length !== WORD_LEN) return false;
    if (letterDiff(path[i - 1], path[i]) !== 1) return false;
  }
  return path[0].length === WORD_LEN;
}

/**
 * Fairness gate: every word must be 5 letters, in the dictionary, and each
 * consecutive pair a one-letter change. Returns true if shippable.
 */
export function isFairPath(path: string[], dictionary: ReadonlySet<string>): boolean {
  if (!isValidLadder(path)) return false;
  return path.every((w) => dictionary.has(w.toUpperCase()));
}

/** Build a validated puzzle from a ladder path. */
export function buildPuzzle(path: string[], dictionary: ReadonlySet<string>, puzzleId: string): Puzzle | null {
  const upper = path.map((w) => w.toUpperCase());
  if (!isFairPath(upper, dictionary)) return null;
  return { puzzleId, path: upper };
}

/** Gate assertion for an emitted puzzle. */
export function assertPuzzleValid(p: Puzzle, dictionary: ReadonlySet<string>): void {
  if (!isFairPath(p.path, dictionary)) throw new Error(`invalid drift path for ${p.puzzleId}: ${p.path.join(">")}`);
}

/**
 * Discover ladder paths of a target length via BFS over the one-letter-change graph
 * restricted to the given word set. Deterministic (sorted neighbours).
 */
export function findLadders(
  words: string[],
  dictionary: ReadonlySet<string>,
  length: number,
  maxPaths: number,
): string[][] {
  const wordArr = [...words].filter((w) => w.length === WORD_LEN).sort();
  const wordSet = new Set(wordArr.map((w) => w.toUpperCase()));
  const neighbours = (w: string): string[] => {
    const out: string[] = [];
    const up = w.toUpperCase();
    for (let i = 0; i < WORD_LEN; i++) {
      for (let cc = 65; cc <= 90; cc++) {
        const ch = String.fromCharCode(cc);
        if (ch === up[i]) continue;
        const cand = up.slice(0, i) + ch + up.slice(i + 1);
        if (wordSet.has(cand)) out.push(cand);
      }
    }
    return out.sort();
  };

  const paths: string[][] = [];
  const seenStart = new Set<string>();
  for (const start of wordArr.map((w) => w.toUpperCase())) {
    if (paths.length >= maxPaths) break;
    if (seenStart.has(start)) continue;
    // DFS to build a simple path of exactly `length`.
    const path: string[] = [start];
    const used = new Set([start]);
    const dfs = (): boolean => {
      if (path.length === length) return true;
      for (const nb of neighbours(path[path.length - 1])) {
        if (used.has(nb)) continue;
        used.add(nb);
        path.push(nb);
        if (dfs()) return true;
        path.pop();
        used.delete(nb);
      }
      return false;
    };
    if (dfs() && isFairPath(path, dictionary)) {
      paths.push([...path]);
      for (const w of path) seenStart.add(w); // avoid heavily-overlapping paths
    }
  }
  return paths;
}
