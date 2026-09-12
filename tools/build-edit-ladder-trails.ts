import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, buildEditDistanceGraph } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { packBoard, validatePuzzle, isValidLadder, mulberry32, type PackInput } from "../src/games/edit-ladder-trails/content-build.ts";
import type { Puzzle } from "../src/games/edit-ladder-trails/types.ts";

// Edit-Ladder Trails build tool. Deterministically generates daily boards:
//   1) extract a 4-rung edit-distance-1 ladder of 5-letter words (buildEditDistanceGraph);
//   2) pick an 8-letter spangram + two 4-letter fillers (frequency-tiered corpus);
//   3) pack into a 6x6 perfect cover via the seeded, node-budgeted packer, spangram
//      spanning top->bottom; retry with fresh seeds until fair or attempts exhausted;
//   4) validate every board through the fairness gate before shipping.
// GloVe is not needed here — the ladder is a structural (edit-graph) theme.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const TARGET_PUZZLES = 150;
const NODE_BUDGET = 150000;
const RETRIES_PER_PUZZLE = 8;

// RISK-012 — the en-GB corpus contains obscenities/slurs unsuitable for a family
// daily game. Reject any word matching this blocklist from ladders, spangrams and
// fillers. Kept deliberately broad; false positives just drop candidate words.
const BLOCKED = /(slut|shit|piss|cock|dick|tits|arse|turd|fuck|cunt|wank|twat|bitch|whore|nigg|spic|kike|coon|fag|rape|semen|penis|vagina|boob|willy|poo|wee|butt|damn|hell|bloody|bugger|bollock|prick|knob|smut|scum|slag|tart|hooker|junkie|heroin|cocaine)/i;
function clean(words: string[]): string[] { return words.filter((w) => !BLOCKED.test(w)); }

function extractLadder(adj: Map<string, Set<string>>, words: string[], rand: () => number): string[] | null {
  for (let restart = 0; restart < 10; restart++) {
    const start = words[Math.floor(rand() * words.length)];
    const path = [start];
    const used = new Set([start]);
    const dfs = (): boolean => {
      if (path.length === 4) return true;
      const cur = path[path.length - 1];
      const ns = [...(adj.get(cur) ?? [])].filter((w) => w.length === 5 && !used.has(w));
      for (let i = ns.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ns[i], ns[j]] = [ns[j], ns[i]]; }
      for (const n of ns) { path.push(n); used.add(n); if (dfs()) return true; path.pop(); used.delete(n); }
      return false;
    };
    if (dfs() && isValidLadder(path)) return path;
  }
  return null;
}

function main(): void {
  const five = clean(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [5, 5] })));
  const graph = buildEditDistanceGraph(five);
  const adj = new Map<string, Set<string>>();
  for (const [w, ns] of graph) adj.set(w, new Set(ns));
  const span8 = clean(filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [8, 8] })));
  const filler4 = clean(filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [4, 4] })));

  const puzzles: Puzzle[] = [];
  const seenLadders = new Set<string>();
  let day = 0;
  let attempts = 0;
  while (puzzles.length < TARGET_PUZZLES && attempts < TARGET_PUZZLES * 4) {
    attempts++;
    let built: Puzzle | null = null;
    for (let r = 0; r < RETRIES_PER_PUZZLE && !built; r++) {
      const rand = mulberry32(fnv1a32(`edit-ladder-trails|${day}|${r}`));
      const ladder = extractLadder(adj, five, rand);
      if (!ladder) continue;
      const key = ladder.join(">");
      if (seenLadders.has(key)) continue;
      const spangram = span8[Math.floor(rand() * span8.length)];
      const f1 = filler4[Math.floor(rand() * filler4.length)];
      const f2 = filler4[Math.floor(rand() * filler4.length)];
      if (f1 === f2) continue;
      const input: PackInput = { ladder, spangram, filler: [f1, f2] };
      const packed = packBoard(input, rand, { nodes: NODE_BUDGET });
      if (!packed) continue;
      const candidate: Puzzle = {
        puzzleId: `puz-${puzzles.length.toString().padStart(4, "0")}`,
        letters: packed.letters,
        answers: packed.answers,
        ladder,
        spangram,
      };
      if (validatePuzzle(candidate) === null) { built = candidate; seenLadders.add(key); }
    }
    day++;
    if (built) puzzles.push(built);
  }

  if (puzzles.length === 0) throw new Error("edit-ladder-trails: no fair boards produced");

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC",
    fairnessGateVersion: "1.0.0",
    puzzles,
  };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "edit-ladder-trails.json"), json);
  // eslint-disable-next-line no-console
  console.log(`edit-ladder-trails.json: ${puzzles.length} boards from ${day} day-seeds (${attempts} attempts), ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 6)) console.log(`  span=${p.spangram} ladder=[${p.ladder.join(">")}]`);
}

main();
