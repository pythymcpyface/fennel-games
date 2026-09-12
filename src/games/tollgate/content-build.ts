import type { Puzzle } from "./types.ts";
import { tollOf, singleDiffIndex } from "./engine.ts";

// Build-time content generation + fairness gate for Tollgate. Pure + deterministic.
// Uses Dijkstra over the one-letter-change word graph (edge weight = toll of the
// introduced letter) to compute par and prove reachability (TERM-015/030).

/** All one-letter-change neighbours of `word` present in the word set. */
export function neighbours(word: string, wordSet: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const up = word.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    for (let c = 65; c <= 90; c++) {
      const ch = String.fromCharCode(c);
      if (ch === up[i]) continue;
      const cand = up.slice(0, i) + ch + up.slice(i + 1);
      if (wordSet.has(cand)) out.push(cand);
    }
  }
  return out;
}

/**
 * Dijkstra minimum total cost from `start` to `target`. Edge weight = toll of the
 * introduced letter (the letter at the differing index of the destination word).
 * Returns the min cost, or Infinity if unreachable. Uses a simple array-based PQ
 * (word sets are bounded for a fixed length).
 */
export function dijkstraParCost(
  start: string,
  target: string,
  tolls: number[],
  wordSet: ReadonlySet<string>,
): number {
  const S = start.toUpperCase();
  const T = target.toUpperCase();
  if (!wordSet.has(S) || !wordSet.has(T)) return Number.POSITIVE_INFINITY;
  const dist = new Map<string, number>();
  dist.set(S, 0);
  const visited = new Set<string>();
  // Bounded Dijkstra with a linear-scan frontier (fine for one word length).
  const frontier = new Set<string>([S]);
  while (frontier.size > 0) {
    // pop min-dist node
    let u: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const w of frontier) {
      const d = dist.get(w) ?? Number.POSITIVE_INFINITY;
      if (d < best) { best = d; u = w; }
    }
    if (u === null) break;
    frontier.delete(u);
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === T) return best;
    for (const v of neighbours(u, wordSet)) {
      if (visited.has(v)) continue;
      const idx = singleDiffIndex(u, v);
      const w = best + tollOf(v[idx], tolls);
      if (w < (dist.get(v) ?? Number.POSITIVE_INFINITY)) {
        dist.set(v, w);
        frontier.add(v);
      }
    }
  }
  return dist.get(T) ?? Number.POSITIVE_INFINITY;
}

/**
 * Build a validated puzzle. The fairness gate requires the target reachable and
 * computes par via Dijkstra. Returns null if unreachable or par is 0 (degenerate).
 */
export function buildPuzzle(
  start: string,
  target: string,
  tolls: number[],
  wordSet: ReadonlySet<string>,
  puzzleId: string,
): Puzzle | null {
  const S = start.toUpperCase();
  const T = target.toUpperCase();
  if (S === T) return null;
  const par = dijkstraParCost(S, T, tolls, wordSet);
  if (!Number.isFinite(par) || par <= 0) return null;
  return { puzzleId, start: S, target: T, tolls: [...tolls], par };
}

/** Gate assertion: par is finite/positive and recomputes from Dijkstra. */
export function assertPuzzleValid(p: Puzzle, wordSet: ReadonlySet<string>): void {
  const par = dijkstraParCost(p.start, p.target, p.tolls, wordSet);
  if (par !== p.par) throw new Error(`tollgate ${p.puzzleId}: par mismatch (${par} != ${p.par})`);
  if (!Number.isFinite(par) || par <= 0) throw new Error(`tollgate ${p.puzzleId}: unreachable/degenerate`);
}
