import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, buildEditDistanceGraph } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidateBoard } from "../src/games/edit-clusters/content-build.ts";
import { BOARD_SIZE, CLUSTER_SIZE } from "../src/games/edit-clusters/types.ts";

// Edit Clusters build tool. Uses wordkit's edit-distance graph (one-letter-change
// adjacency) over common 4-letter words. Strategy: enumerate 4-cliques as target
// clusters, then add decoy words that keep the clique the UNIQUE densest 4-subset.
// The content-build fairness gate enforces strict-max uniqueness.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const WORD_LEN = 4;
const MAX_PUZZLES = 200;
const DECOY_COUNT = BOARD_SIZE - CLUSTER_SIZE;

function main(): void {
  const words = filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [WORD_LEN, WORD_LEN] }));
  const graph = buildEditDistanceGraph(words);
  const adj = new Map<string, Set<string>>();
  for (const [w, ns] of graph) adj.set(w, new Set(ns));

  // Deterministic word ordering for stable puzzle selection.
  const ordered = [...words].sort((a, b) => fnv1a32(a) - fnv1a32(b));

  // Enumerate 4-cliques (target clusters).
  const cliques: string[][] = [];
  const hubs = ordered.filter((w) => (adj.get(w)?.size ?? 0) >= 3);
  outer: for (const a of hubs) {
    const na = [...(adj.get(a) ?? [])].sort();
    for (let i = 0; i < na.length; i++) {
      for (let j = i + 1; j < na.length; j++) {
        const b = na[i], c = na[j];
        if (!adj.get(b)?.has(c)) continue;
        for (const d of na) {
          if (d <= c) continue;
          if (adj.get(b)?.has(d) && adj.get(c)?.has(d)) {
            cliques.push([a, b, c, d].sort());
            if (cliques.length > MAX_PUZZLES * 8) break outer;
          }
        }
      }
    }
  }

  // Build candidate boards: clique + decoys with LOW connectivity to the clique
  // and to each other, so the clique stays the unique densest subset.
  const candidates: CandidateBoard[] = [];
  const usedClusters = new Set<string>();
  // Avoid many near-identical boards: cap how many clusters may share any single word.
  const wordUse = new Map<string, number>();
  const MAX_WORD_REUSE = 6;
  for (const clique of cliques) {
    const key = clique.join(",");
    if (usedClusters.has(key)) continue;
    if (clique.some((w) => (wordUse.get(w) ?? 0) >= MAX_WORD_REUSE)) continue;
    const clusterSet = new Set(clique);

    // decoy pool: words not in clique, spread deterministically, each decoy also
    // rate-limited so boards don't all reuse the same handful of filler words.
    const decoys: string[] = [];
    for (const w of ordered) {
      if (clusterSet.has(w)) continue;
      if ((wordUse.get(w) ?? 0) >= MAX_WORD_REUSE) continue;
      const ns = adj.get(w) ?? new Set();
      // reject decoys adjacent to 2+ clique members (would raise rival density).
      let touch = 0;
      for (const cw of clique) if (ns.has(cw)) touch += 1;
      if (touch >= 2) continue;
      // reject decoys adjacent to 2+ already-chosen decoys.
      let dtouch = 0;
      for (const dw of decoys) if (ns.has(dw)) dtouch += 1;
      if (dtouch >= 2) continue;
      decoys.push(w);
      if (decoys.length === DECOY_COUNT) break;
    }
    if (decoys.length < DECOY_COUNT) continue;

    const board = [...clique, ...decoys].sort();
    // board-restricted adjacency.
    const adjacency: Record<string, string[]> = {};
    for (const w of board) adjacency[w] = board.filter((o) => o !== w && adj.get(w)?.has(o)).sort();
    usedClusters.add(key);
    for (const w of board) wordUse.set(w, (wordUse.get(w) ?? 0) + 1);
    candidates.push({ board, cluster: clique, adjacency });
    if (candidates.length >= MAX_PUZZLES) break;
  }

  const puzzles = buildPuzzles(candidates);
  assertPuzzlesValid(puzzles);
  if (puzzles.length === 0) throw new Error("edit-clusters: no fair boards produced");

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC",
    puzzles,
  };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "edit-clusters.json"), json);
  // eslint-disable-next-line no-console
  console.log(`edit-clusters.json: ${puzzles.length}/${candidates.length} boards passed (from ${cliques.length} cliques), ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 8)) console.log(`  cluster [${p.cluster.join(" ")}] max=${p.maxEdges} board {${p.board.join(" ")}}`);
}

main();
