import type { CandidatePair, LengthDataset } from "./types.ts";
import { buildAdjacency, computeComponents, shortestPath } from "./engine.ts";

// Build-time content generation for Word Morph. Pure + deterministic. Ported
// from the standalone app's scripts/build-dataset.ts. The WORD LIST is supplied
// by the caller (the build tool sources it from wordkit loadCorpus, en-GB),
// replacing the standalone's curated data/words-*.txt files.

export const MIN_PAR = 3;
export const MAX_PAR = 6;
export const MAX_PAIRS_PER_PAR = 500;

function computePar(adjacency: number[][], s: number, t: number): number | null {
  const path = shortestPath(adjacency, s, t);
  return path ? path.length - 1 : null;
}

/** Build one length dataset: filter to fixed length, drop denylisted, build the
 * graph + components, and sample solvable pairs with par in [MIN_PAR, MAX_PAR].
 * Adjacency is emitted empty (rebuilt client-side) to keep the payload small. */
export function buildLengthDataset(
  words: readonly string[],
  denylist: ReadonlySet<string>,
  wordLength: number,
): LengthDataset {
  const dictionaryId = `words-${wordLength}-v1`;
  const filtered = [
    ...new Set(
      words
        .map((w) => w.trim().toLowerCase())
        .filter((w) => /^[a-z]+$/.test(w) && w.length === wordLength && !denylist.has(w)),
    ),
  ].sort();

  const adjacency = buildAdjacency(filtered);
  const { componentIdByWordIndex, componentCount } = computeComponents(adjacency);

  const componentSize = new Array<number>(componentCount).fill(0);
  for (const c of componentIdByWordIndex) componentSize[c]++;

  const pairs: CandidatePair[] = [];
  const perParCount: Record<number, number> = {};
  const budget = MAX_PAIRS_PER_PAR * (MAX_PAR - MIN_PAR + 1);
  for (let i = 0; i < filtered.length; i++) {
    if (componentSize[componentIdByWordIndex[i]] < MIN_PAR + 1) continue;
    if (pairs.length >= budget) break;
    for (let j = i + 1; j < filtered.length; j++) {
      if (componentIdByWordIndex[i] !== componentIdByWordIndex[j]) continue;
      const par = computePar(adjacency, i, j);
      if (par === null || par < MIN_PAR || par > MAX_PAR) continue;
      if ((perParCount[par] ?? 0) >= MAX_PAIRS_PER_PAR) continue;
      perParCount[par] = (perParCount[par] ?? 0) + 1;
      pairs.push({ startWordIndex: i, targetWordIndex: j, par, componentId: componentIdByWordIndex[i] });
    }
  }

  if (pairs.length === 0) {
    throw new Error(`word-morph: no candidate pairs for wordLength=${wordLength}`);
  }

  return {
    wordLength,
    dictionaryId,
    dictionaryWords: filtered,
    adjacency: [], // rebuilt on load
    componentIdByWordIndex,
    componentCount,
    candidatePairs: pairs,
  };
}
