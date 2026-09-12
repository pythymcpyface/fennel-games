// Word Morph hint: the lexicographically-smallest next word that lies on a
// shortest path to the target. Ported from the standalone app's engine/hint.ts.

import type { LengthDataset, PuzzleState } from "./types.ts";
import { currentWord, hammingDistance } from "./engine.ts";

export type HintStatus = "OK" | "ALREADY_SOLVED" | "ERROR_INVALID_STATE";
export interface HintResult {
  hintStatus: HintStatus;
  hintNextWordText: string | null;
}

/** BFS distances from the target to every node (undirected graph). -1 = unreachable. */
function distancesToTarget(adjacency: number[][], targetIndex: number): number[] {
  const dist = new Array<number>(adjacency.length).fill(-1);
  dist[targetIndex] = 0;
  const queue = [targetIndex];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adjacency[cur]) {
      if (dist[nb] === -1) {
        dist[nb] = dist[cur] + 1;
        queue.push(nb);
      }
    }
  }
  return dist;
}

export function computeHintNextWord(dataset: LengthDataset, state: PuzzleState): HintResult {
  const cur = currentWord(state);
  if (cur === state.targetWordText) return { hintStatus: "ALREADY_SOLVED", hintNextWordText: null };

  const curIndex = dataset.dictionaryWords.indexOf(cur);
  const targetIndex = dataset.dictionaryWords.indexOf(state.targetWordText);
  if (curIndex === -1 || targetIndex === -1) return { hintStatus: "ERROR_INVALID_STATE", hintNextWordText: null };

  const dist = distancesToTarget(dataset.adjacency, targetIndex);
  const curDist = dist[curIndex];
  if (curDist <= 0) return { hintStatus: "ERROR_INVALID_STATE", hintNextWordText: null };

  let best: string | null = null;
  for (const nb of dataset.adjacency[curIndex]) {
    if (dist[nb] !== curDist - 1) continue;
    const word = dataset.dictionaryWords[nb];
    if (hammingDistance(word, cur) !== 1) continue;
    if (best === null || word < best) best = word;
  }
  if (best === null) return { hintStatus: "ERROR_INVALID_STATE", hintNextWordText: null };
  return { hintStatus: "OK", hintNextWordText: best };
}
