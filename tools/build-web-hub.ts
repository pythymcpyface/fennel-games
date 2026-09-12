import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, buildEditDistanceGraph } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzles, assertPuzzlesValid, type CandidateBoard } from "../src/games/web-hub/content-build.ts";
import { BOARD_SIZE } from "../src/games/web-hub/types.ts";

// Web Hub build tool. Uses wordkit's edit-distance graph. Strategy: for each hub
// candidate, place the hub + HUB_LINKS of its neighbours + low-connectivity decoys
// so the hub has the strictly-highest within-board degree. The content-build gate
// enforces a unique max degree with a clear margin.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const WORD_LEN = 4;
const HUB_LINKS = 4; // neighbours of the hub placed on the board
const MARGIN = 2;
const MAX_PUZZLES = 120;

function main(): void {
  const words = filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [WORD_LEN, WORD_LEN] }));
  const graph = buildEditDistanceGraph(words);
  const adj = new Map<string, Set<string>>();
  for (const [w, ns] of graph) adj.set(w, new Set(ns));

  const ordered = [...words].sort((a, b) => fnv1a32(a) - fnv1a32(b));
  const hubCandidates = ordered.filter((w) => (adj.get(w)?.size ?? 0) >= HUB_LINKS + 2);

  const candidates: CandidateBoard[] = [];
  const wordUse = new Map<string, number>();
  const MAX_REUSE = 5;
  for (const hub of hubCandidates) {
    if ((wordUse.get(hub) ?? 0) >= MAX_REUSE) continue;
    const hubNs = [...(adj.get(hub) ?? [])].sort((a, b) => fnv1a32(a) - fnv1a32(b));
    // Choose HUB_LINKS neighbours that do NOT connect to each other much (keep their
    // own board degree low so the hub stays the clear max).
    const links: string[] = [];
    for (const n of hubNs) {
      if ((wordUse.get(n) ?? 0) >= MAX_REUSE) continue;
      // reject neighbour that is adjacent to 2+ already-picked links (raises their degree)
      let t = 0;
      for (const l of links) if (adj.get(n)?.has(l)) t += 1;
      if (t >= 1) continue;
      links.push(n);
      if (links.length === HUB_LINKS) break;
    }
    if (links.length < HUB_LINKS) continue;

    // Decoys: words NOT adjacent to the hub and adjacent to at most 1 board word.
    const chosen = new Set([hub, ...links]);
    const decoys: string[] = [];
    const needed = BOARD_SIZE - 1 - HUB_LINKS;
    for (const w of ordered) {
      if (chosen.has(w)) continue;
      if ((wordUse.get(w) ?? 0) >= MAX_REUSE) continue;
      if (adj.get(hub)?.has(w)) continue; // decoys must not link to the hub
      let t = 0;
      for (const b of chosen) if (adj.get(w)?.has(b)) t += 1;
      for (const d of decoys) if (adj.get(w)?.has(d)) t += 1;
      if (t >= 2) continue; // keep decoy degree low
      decoys.push(w);
      chosen.add(w);
      if (decoys.length === needed) break;
    }
    if (decoys.length < needed) continue;

    const board = [...chosen].sort();
    const adjacency: Record<string, string[]> = {};
    for (const w of board) adjacency[w] = board.filter((o) => o !== w && adj.get(w)?.has(o)).sort();
    const cand: CandidateBoard = { board, adjacency };
    // Verify hub is the strict max before committing (cheap pre-check).
    const deg = (w: string) => adjacency[w].length;
    const others = board.filter((w) => w !== hub).map(deg).sort((a, b) => b - a);
    if (deg(hub) < others[0] + MARGIN) continue;

    for (const w of board) wordUse.set(w, (wordUse.get(w) ?? 0) + 1);
    candidates.push(cand);
    if (candidates.length >= MAX_PUZZLES) break;
  }

  const puzzles = buildPuzzles(candidates, MARGIN);
  assertPuzzlesValid(puzzles, MARGIN);
  if (puzzles.length === 0) throw new Error("web-hub: no fair boards produced");

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
  writeFileSync(join(outDir, "web-hub.json"), json);
  // eslint-disable-next-line no-console
  console.log(`web-hub.json: ${puzzles.length}/${candidates.length} boards, ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 8)) console.log(`  hub=${p.hub}(${p.degrees[p.hub]}) board {${p.board.join(" ")}}`);
}

main();
