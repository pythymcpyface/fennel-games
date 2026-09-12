import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, loadGloveVectors, buildRankTable } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { packPerfectCover, lettersFromPlacements, mulberry32, topRowCells, rowOfIn, type GridDims, type WordSpec } from "../src/kit/grid-pack.ts";
import { toPuzzle, validatePuzzle, type CandidatePuzzle, type ThemePick } from "../src/games/semantic-gradient/content-build.ts";
import type { Answer, Puzzle } from "../src/games/semantic-gradient/types.ts";

// Semantic Gradient build tool. Deterministically generates daily boards:
//   1) pick a hidden anchor from the tiered en-GB corpus (in GloVe);
//   2) buildRankTable over a bounded content-word universe;
//   3) select four 5-letter neighbours in decisive, well-separated RANK bands
//      (hot..cold), an 8-letter spangram neighbour, and two 4-letter fillers;
//   4) pack into a 6x6 perfect cover via the shared kit (spangram spans top->bottom);
//   5) validate via the fairness gate (bands distinct + decisive, cover, spanning).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const TARGET_PUZZLES = 120;
const NODE_BUDGET = 150000;
const UNIVERSE_CAP = 1500;
const G: GridDims = { rows: 6, cols: 6 };

const BLOCKED = /(slut|shit|piss|cock|dick|tits|arse|turd|fuck|cunt|wank|twat|bitch|whore|nigg|spic|kike|coon|fag|rape|semen|penis|vagina|boob|willy|damn|hell|bloody|bugger|bollock|prick|knob|smut|slag|hooker|junkie|heroin|cocaine)/i;
const clean = (ws: string[]): string[] => ws.filter((w) => !BLOCKED.test(w));

function sampleSpread(pool: string[], n: number): string[] {
  if (pool.length <= n) return [...pool];
  return [...pool].sort((a, b) => fnv1a32(a) - fnv1a32(b)).slice(0, n).sort();
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const glovePath = join(here, "..", "wordkit", "vectors", "glove.6B.50d.txt");
  if (!existsSync(glovePath)) throw new Error(`GloVe vectors not found at ${glovePath}.`);
  const provider = loadGloveVectors(glovePath);

  const anchors = clean(filterAlphaOnly(loadCorpus({ maxTier: 20, lengths: [4, 8] }))).filter((w) => provider.has(w));
  const five = clean(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [5, 5] }))).filter((w) => provider.has(w));
  const eight = clean(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [8, 8] }))).filter((w) => provider.has(w));
  const four = clean(filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [4, 4] })));
  // shared ranking universe: content words spread across the alphabet.
  const universe = sampleSpread(clean(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [4, 9] }))).filter((w) => provider.has(w)), UNIVERSE_CAP);

  const puzzles: Puzzle[] = [];
  const usedAnchors = new Set<string>();
  let attempts = 0;
  while (puzzles.length < TARGET_PUZZLES && attempts < TARGET_PUZZLES * 8) {
    attempts++;
    const rand = mulberry32(fnv1a32(`semantic-gradient|${attempts}`));
    const anchor = anchors[Math.floor(rand() * anchors.length)];
    if (usedAnchors.has(anchor)) continue;

    // rank the universe (+ the specific candidate words) against the anchor.
    const uni = [...new Set([anchor, ...universe, ...five, ...eight])];
    const table = buildRankTable(anchor, uni, provider);
    const rankOf = (w: string): number => table.ranks[w] ?? Number.MAX_SAFE_INTEGER;

    // 5-letter neighbours sorted by closeness, excluding the anchor itself.
    const fiveByRank = five.filter((w) => w !== anchor).sort((a, b) => rankOf(a) - rankOf(b));
    if (fiveByRank.length < 20) continue;
    // pick 4 at spread rank bands so they land in decisive HOT/WARM/COOL/COLD.
    const bandTargets = [3, 12, 30, 70];
    const themes: ThemePick[] = [];
    const takenWords = new Set<string>();
    for (const bt of bandTargets) {
      let best: string | null = null; let bestDelta = Infinity;
      for (const w of fiveByRank) {
        if (takenWords.has(w)) continue;
        const d = Math.abs(rankOf(w) - bt);
        if (d < bestDelta) { bestDelta = d; best = w; }
      }
      if (!best) break;
      takenWords.add(best);
      themes.push({ word: best, rank: rankOf(best) });
    }
    if (themes.length !== 4) continue;

    // spangram: a strong 8-letter neighbour (rank <= 200), distinct.
    const span = eight.filter((w) => rankOf(w) <= 250 && w !== anchor).sort((a, b) => rankOf(a) - rankOf(b))[0];
    if (!span) continue;
    // fillers: any two distinct 4-letter words not colliding with theme/span/anchor.
    const f1 = four[Math.floor(rand() * four.length)];
    const f2 = four[Math.floor(rand() * four.length)];
    if (!f1 || !f2 || f1 === f2) continue;
    const allWords = [span, ...themes.map((t) => t.word), f1, f2];
    if (new Set(allWords).size !== allWords.length) continue;

    // pack: spangram first (top->bottom), then themes + fillers.
    const specs: WordSpec[] = [
      { word: span, startCells: topRowCells(G), endPredicate: (c, g) => rowOfIn(c, g) === g.rows - 1 },
      ...themes.map((t) => ({ word: t.word })),
      { word: f1 }, { word: f2 },
    ];
    const placed = packPerfectCover(specs, G, rand, { nodes: NODE_BUDGET });
    if (!placed) continue;
    const letters = lettersFromPlacements(placed, G);
    if (!letters) continue;

    // map placements to typed placements for content-build.
    const typed = placed.map((p) => {
      const type: Answer["type"] = p.word === span ? "spangram" : themes.some((t) => t.word === p.word) ? "theme" : "filler";
      return { word: p.word, type, path: p.path };
    });
    const cand: CandidatePuzzle = { anchor, spangram: span, themes, fillers: [f1, f2], placements: typed, letters };
    const puzzle = toPuzzle(cand, `puz-${puzzles.length.toString().padStart(4, "0")}`);
    if (!puzzle) continue;
    if (validatePuzzle(puzzle) !== null) continue;
    usedAnchors.add(anchor);
    puzzles.push(puzzle);
  }

  if (puzzles.length === 0) throw new Error("semantic-gradient: no fair boards produced");

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
  writeFileSync(join(outDir, "semantic-gradient.json"), json);
  // eslint-disable-next-line no-console
  console.log(`semantic-gradient.json: ${puzzles.length} boards (${attempts} attempts), ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 6)) {
    const themes = p.answers.filter((a) => a.type === "theme").map((a) => `${a.word}[${a.band}]`);
    const span = p.answers.find((a) => a.type === "spangram")!.word;
    console.log(`  anchor=${p.anchor} span=${span} themes=${themes.join(" ")}`);
  }
}

main();
