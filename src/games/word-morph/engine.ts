// Word Morph pure engine. Ported from the standalone app's engine/{validation,
// graph,state,dataset}.ts. Deterministic, DOM-free. Daily selection uses the
// hub's shared FNV-1a (kit/selection.ts) so seeds match the rest of the hub.

import type { LengthDataset, PuzzleState, ValidationResult, GameStatus } from "./types.ts";
import { fnv1a32 } from "../../kit/selection.ts";

// ---- validation -------------------------------------------------------------

export function normalizeSubmission(
  raw: string,
  wordLength: number,
): { ok: true; word: string } | { ok: false; result: ValidationResult } {
  const word = raw.trim().toLowerCase();
  if (!/^[a-z]+$/.test(word)) return { ok: false, result: "INVALID_CHARS" };
  if (word.length !== wordLength) return { ok: false, result: "INVALID_LENGTH" };
  return { ok: true, word };
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error("hammingDistance: length mismatch");
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

export function validateMove(
  normalized: string,
  currentWord: string,
  dictionary: ReadonlySet<string>,
): ValidationResult {
  if (normalized === currentWord) return "SAME_AS_CURRENT";
  if (!dictionary.has(normalized)) return "NOT_IN_DICTIONARY";
  if (hammingDistance(normalized, currentWord) !== 1) return "NOT_ONE_LETTER";
  return "VALID";
}

// ---- graph ------------------------------------------------------------------

/** Build one-letter-change adjacency via wildcard bucketing (Hamming distance 1). */
export function buildAdjacency(words: string[]): number[][] {
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    for (let p = 0; p < w.length; p++) {
      const pattern = w.slice(0, p) + "*" + w.slice(p + 1);
      let bucket = buckets.get(pattern);
      if (!bucket) buckets.set(pattern, (bucket = []));
      bucket.push(i);
    }
  }
  const adj: Set<number>[] = words.map(() => new Set<number>());
  for (const bucket of buckets.values()) {
    for (let a = 0; a < bucket.length; a++) {
      for (let b = a + 1; b < bucket.length; b++) {
        adj[bucket[a]].add(bucket[b]);
        adj[bucket[b]].add(bucket[a]);
      }
    }
  }
  return adj.map((s) => [...s].sort((x, y) => x - y));
}

export function computeComponents(adjacency: number[][]): {
  componentIdByWordIndex: number[];
  componentCount: number;
} {
  const n = adjacency.length;
  const comp = new Array<number>(n).fill(-1);
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (comp[i] !== -1) continue;
    const queue = [i];
    comp[i] = count;
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adjacency[cur]) {
        if (comp[nb] === -1) {
          comp[nb] = count;
          queue.push(nb);
        }
      }
    }
    count++;
  }
  return { componentIdByWordIndex: comp, componentCount: count };
}

export function shortestPath(
  adjacency: number[][],
  startIndex: number,
  targetIndex: number,
): number[] | null {
  if (startIndex === targetIndex) return [startIndex];
  const prev = new Array<number>(adjacency.length).fill(-1);
  const seen = new Array<boolean>(adjacency.length).fill(false);
  const queue = [startIndex];
  seen[startIndex] = true;
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adjacency[cur]) {
      if (seen[nb]) continue;
      seen[nb] = true;
      prev[nb] = cur;
      if (nb === targetIndex) {
        const path: number[] = [];
        for (let at: number = targetIndex; at !== -1; at = prev[at]) path.push(at);
        return path.reverse();
      }
      queue.push(nb);
    }
  }
  return null;
}

export function computeOptimalPathWords(
  dataset: LengthDataset,
  startWord: string,
  targetWord: string,
): string[] | null {
  const s = dataset.dictionaryWords.indexOf(startWord);
  const t = dataset.dictionaryWords.indexOf(targetWord);
  if (s === -1 || t === -1) return null;
  const path = shortestPath(dataset.adjacency, s, t);
  return path ? path.map((i) => dataset.dictionaryWords[i]) : null;
}

// ---- dataset load -----------------------------------------------------------

export class DatasetSchemaError extends Error {}

/** Validate + hydrate a length dataset. Rebuilds adjacency if shipped empty. */
export function loadDataset(data: unknown): LengthDataset {
  if (typeof data !== "object" || data === null) throw new DatasetSchemaError("dataset not an object");
  const d = data as LengthDataset;
  if (typeof d.wordLength !== "number" || d.wordLength < 1) throw new DatasetSchemaError("bad wordLength");
  if (typeof d.dictionaryId !== "string" || d.dictionaryId.length === 0) throw new DatasetSchemaError("bad dictionaryId");
  if (!Array.isArray(d.dictionaryWords) || d.dictionaryWords.length === 0) throw new DatasetSchemaError("bad dictionaryWords");
  const n = d.dictionaryWords.length;
  if (!Array.isArray(d.candidatePairs) || d.candidatePairs.length === 0) throw new DatasetSchemaError("no candidatePairs");
  if (!Array.isArray(d.adjacency) || (d.adjacency.length !== 0 && d.adjacency.length !== n)) {
    throw new DatasetSchemaError("bad adjacency length");
  }
  if (d.adjacency.length === 0) {
    d.adjacency = buildAdjacency(d.dictionaryWords);
  }
  return d;
}

// ---- daily selection --------------------------------------------------------

export const SEED_VERSION = "seed-v1";

/** Deterministic daily pair for a dataset, keyed on dayId + seed + dictionaryId. */
export function selectDailyPair(
  dataset: LengthDataset,
  dayId: string,
): { startWordText: string; targetWordText: string; par: number } {
  const seed = fnv1a32(`${dayId}|${SEED_VERSION}|${dataset.dictionaryId}`);
  const index = seed % dataset.candidatePairs.length;
  const pair = dataset.candidatePairs[index];
  return {
    startWordText: dataset.dictionaryWords[pair.startWordIndex],
    targetWordText: dataset.dictionaryWords[pair.targetWordIndex],
    par: pair.par,
  };
}

// ---- puzzle state -----------------------------------------------------------

export function createInitialState(startWordText: string, targetWordText: string, par: number): PuzzleState {
  return { startWordText, targetWordText, par, moveHistory: [startWordText], gameStatus: "IN_PROGRESS" };
}

export function currentWord(state: PuzzleState): string {
  return state.moveHistory[state.moveHistory.length - 1];
}

export function moveCount(state: PuzzleState): number {
  return state.moveHistory.length - 1;
}

export interface SubmitOutcome {
  state: PuzzleState;
  result: ValidationResult;
}

export function submit(
  state: PuzzleState,
  raw: string,
  dictionary: ReadonlySet<string>,
  wordLength: number,
): SubmitOutcome {
  if (state.gameStatus === "WON") return { state, result: "SAME_AS_CURRENT" };
  const norm = normalizeSubmission(raw, wordLength);
  if (!norm.ok) return { state, result: norm.result };
  const result = validateMove(norm.word, currentWord(state), dictionary);
  if (result !== "VALID") return { state, result };
  const won = norm.word === state.targetWordText;
  const nextStatus: GameStatus = won ? "WON" : "IN_PROGRESS";
  return {
    state: { ...state, moveHistory: [...state.moveHistory, norm.word], gameStatus: nextStatus },
    result: "VALID",
  };
}

export function undo(state: PuzzleState): PuzzleState {
  if (state.gameStatus === "WON" || moveCount(state) === 0) return state;
  return { ...state, moveHistory: state.moveHistory.slice(0, -1) };
}

export function reset(state: PuzzleState): PuzzleState {
  return { ...state, moveHistory: [state.startWordText], gameStatus: "IN_PROGRESS" };
}
