import type { Puzzle } from "./types.ts";
import { isOneLetterChange } from "./engine.ts";

// Build-time content generation + fairness gate for Fork. Pure + deterministic.
// BFS over the one-letter-change word graph gives shortest distances; par is the
// minimum over all fork words f of dist(start,f) + dist(f,A) + dist(f,B).

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

/** BFS shortest-path distances (in steps) from `source` to all reachable words. */
export function bfsDistances(source: string, wordSet: ReadonlySet<string>): Map<string, number> {
  const dist = new Map<string, number>();
  const src = source.toUpperCase();
  if (!wordSet.has(src)) return dist;
  dist.set(src, 0);
  const queue: string[] = [src];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    const du = dist.get(u)!;
    for (const v of neighbours(u, wordSet)) {
      if (!dist.has(v)) {
        dist.set(v, du + 1);
        queue.push(v);
      }
    }
  }
  return dist;
}

/**
 * Compute par: min over all words f reachable from start of
 * dist(start,f) + dist(f,A) + dist(f,B). Returns Infinity if either target
 * unreachable. Uses distances from start, A, and B (A/B distances via BFS from
 * the targets, valid because the graph is undirected).
 */
export function computePar(start: string, targetA: string, targetB: string, wordSet: ReadonlySet<string>): number {
  const dS = bfsDistances(start, wordSet);
  const dA = bfsDistances(targetA, wordSet);
  const dB = bfsDistances(targetB, wordSet);
  if (!dA.has(start.toUpperCase()) || !dB.has(start.toUpperCase())) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const [f, dsf] of dS) {
    const a = dA.get(f);
    const b = dB.get(f);
    if (a === undefined || b === undefined) continue;
    best = Math.min(best, dsf + a + b);
  }
  return best;
}

/** Build a validated puzzle; fairness gate requires both targets reachable. */
export function buildPuzzle(
  start: string,
  targetA: string,
  targetB: string,
  wordSet: ReadonlySet<string>,
  puzzleId: string,
): Puzzle | null {
  const S = start.toUpperCase();
  const A = targetA.toUpperCase();
  const B = targetB.toUpperCase();
  if (new Set([S, A, B]).size !== 3) return null;
  if (S.length !== A.length || S.length !== B.length) return null;
  const par = computePar(S, A, B, wordSet);
  if (!Number.isFinite(par) || par <= 0) return null;
  return { puzzleId, start: S, targetA: A, targetB: B, wordLength: S.length, par };
}

export function assertPuzzleValid(p: Puzzle, wordSet: ReadonlySet<string>): void {
  const par = computePar(p.start, p.targetA, p.targetB, wordSet);
  if (par !== p.par) throw new Error(`fork ${p.puzzleId}: par mismatch (${par} != ${p.par})`);
  if (!Number.isFinite(par) || par <= 0) throw new Error(`fork ${p.puzzleId}: unreachable/degenerate`);
}

// re-export for tests
export { isOneLetterChange };
