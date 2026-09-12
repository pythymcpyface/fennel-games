import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly, loadGloveVectors, buildRankTable } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import { packPerfectCover, lettersFromPlacements, mulberry32, topRowCells, rowOfIn, type GridDims, type WordSpec } from "../src/kit/grid-pack.ts";
import { toPuzzle, validatePuzzle, type CandidatePuzzle, type ThemePick } from "../src/games/semantic-constellation/content-build.ts";
import type { Answer, Puzzle } from "../src/games/semantic-constellation/types.ts";

// Semantic Constellation build tool. Two hidden anchors A,B; two 5-letter themes
// decisively closer to A (signed rank margin rankB-rankA >= +M) and two closer to
// B (<= -M); an 8-letter spangram that neighbours both; two 4-letter fillers.
// Packed via the shared kit (spangram spans top->bottom), validated by the gate.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "wordkit.en-GB.v1";
const TARGET_PUZZLES = 120;
const NODE_BUDGET = 150000;
const UNIVERSE_CAP = 1500;
const MIN_MARGIN = 25;          // decisive cluster margin (ranks)
const SPAN_MAX_RANK = 400;      // spangram must be within this rank of BOTH anchors
const G: GridDims = { rows: 6, cols: 6 };

const BLOCKED = /(slut|shit|piss|cock|dick|tits|arse|turd|fuck|cunt|wank|twat|bitch|whore|nigg|spic|kike|coon|fag|rape|semen|penis|vagina|boob|willy|damn|hell|bloody|bugger|bollock|prick|knob|smut|slag|hooker|junkie|heroin|cocaine)/i;
// Generic function/connective words that read as decisive by GloVe but confuse
// players as "theme" answers. Dropped from theme candidates only (quality filter).
const NOISE = new Set(["which", "while", "where", "there", "these", "those", "their", "would", "could", "should", "about", "after", "other", "being", "doing", "going", "known", "spare", "sofas"]);
const clean = (ws: string[]): string[] => ws.filter((w) => !BLOCKED.test(w));

function sampleSpread(pool: string[], n: number): string[] {
  if (pool.length <= n) return [...pool];
  return [...pool].sort((a, b) => fnv1a32(a) - fnv1a32(b)).slice(0, n).sort();
}

// Curated distant anchor pairs — two clearly different domains so clusters are
// distinct. The build validates margins; unfair pairs are dropped.
const PAIRS: Array<[string, string]> = [
  ["music", "sport"], ["ocean", "forest"], ["kitchen", "garden"], ["doctor", "farmer"],
  ["winter", "summer"], ["city", "village"], ["space", "ocean"], ["war", "music"],
  ["school", "hospital"], ["desert", "jungle"], ["banking", "farming"], ["painting", "science"],
  ["sailing", "flying"], ["cooking", "gardening"], ["river", "mountain"], ["church", "market"],
  ["engine", "flower"], ["army", "orchestra"], ["harvest", "factory"], ["storm", "library"],
];

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const glovePath = join(here, "..", "wordkit", "vectors", "glove.6B.50d.txt");
  if (!existsSync(glovePath)) throw new Error(`GloVe vectors not found at ${glovePath}.`);
  const provider = loadGloveVectors(glovePath);

  const five = clean(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [5, 5] }))).filter((w) => provider.has(w));
  const eight = clean(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [8, 8] }))).filter((w) => provider.has(w));
  const four = clean(filterAlphaOnly(loadCorpus({ maxTier: 35, lengths: [4, 4] })));
  const universe = sampleSpread(clean(filterAlphaOnly(loadCorpus({ maxTier: 40, lengths: [4, 9] }))).filter((w) => provider.has(w)), UNIVERSE_CAP);

  const puzzles: Puzzle[] = [];
  let attempts = 0;
  let pairIdx = 0;
  while (puzzles.length < TARGET_PUZZLES && attempts < TARGET_PUZZLES * 10) {
    attempts++;
    const [aWord, bWord] = PAIRS[pairIdx % PAIRS.length];
    pairIdx++;
    if (!provider.has(aWord) || !provider.has(bWord)) continue;
    const rand = mulberry32(fnv1a32(`semantic-constellation|${attempts}`));

    const uni = [...new Set([aWord, bWord, ...universe, ...five, ...eight])];
    const tA = buildRankTable(aWord, uni, provider);
    const tB = buildRankTable(bWord, uni, provider);
    const rA = (w: string): number => tA.ranks[w] ?? Number.MAX_SAFE_INTEGER;
    const rB = (w: string): number => tB.ranks[w] ?? Number.MAX_SAFE_INTEGER;
    const margin = (w: string): number => rB(w) - rA(w);   // >0 => closer to A

    const cands = five.filter((w) => w !== aWord && w !== bWord && !NOISE.has(w));
    const aSide = cands.filter((w) => rA(w) <= 120 && margin(w) >= MIN_MARGIN).sort((x, y) => margin(y) - margin(x));
    const bSide = cands.filter((w) => rB(w) <= 120 && margin(w) <= -MIN_MARGIN).sort((x, y) => margin(x) - margin(y));
    if (aSide.length < 2 || bSide.length < 2) continue;
    // spread within each side for variety
    const pick2 = (arr: string[]) => [...arr].sort((x, y) => fnv1a32(x) - fnv1a32(y)).slice(0, 2);
    const aPicks = pick2(aSide.slice(0, 8));
    const bPicks = pick2(bSide.slice(0, 8));
    const themes: ThemePick[] = [
      ...aPicks.map((w) => ({ word: w, margin: margin(w) })),
      ...bPicks.map((w) => ({ word: w, margin: margin(w) })),
    ];

    // spangram: neighbour of BOTH anchors.
    const span = eight.filter((w) => rA(w) <= SPAN_MAX_RANK && rB(w) <= SPAN_MAX_RANK && w !== aWord && w !== bWord)
      .sort((x, y) => (rA(x) + rB(x)) - (rA(y) + rB(y)))[0];
    if (!span) continue;
    const f1 = four[Math.floor(rand() * four.length)];
    const f2 = four[Math.floor(rand() * four.length)];
    if (!f1 || !f2 || f1 === f2) continue;
    const allWords = [span, ...themes.map((t) => t.word), f1, f2];
    if (new Set(allWords).size !== allWords.length) continue;

    const specs: WordSpec[] = [
      { word: span, startCells: topRowCells(G), endPredicate: (c, g) => rowOfIn(c, g) === g.rows - 1 },
      ...themes.map((t) => ({ word: t.word })),
      { word: f1 }, { word: f2 },
    ];
    const placed = packPerfectCover(specs, G, rand, { nodes: NODE_BUDGET });
    if (!placed) continue;
    const letters = lettersFromPlacements(placed, G);
    if (!letters) continue;

    const typed = placed.map((p) => {
      const type: Answer["type"] = p.word === span ? "spangram" : themes.some((t) => t.word === p.word) ? "theme" : "filler";
      return { word: p.word, type, path: p.path };
    });
    const cand: CandidatePuzzle = { anchorA: aWord, anchorB: bWord, spangram: span, themes, fillers: [f1, f2], placements: typed, letters };
    const puzzle = toPuzzle(cand, `puz-${puzzles.length.toString().padStart(4, "0")}`);
    if (!puzzle || validatePuzzle(puzzle) !== null) continue;
    puzzles.push(puzzle);
  }

  if (puzzles.length === 0) throw new Error("semantic-constellation: no fair boards produced");

  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const pack = {
    contentPackVersion: PACK_VERSION, datasetId: DATASET_ID, puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC", fairnessGateVersion: "1.0.0", puzzles,
  };
  const json = JSON.stringify(pack);
  writeFileSync(join(outDir, "semantic-constellation.json"), json);
  // eslint-disable-next-line no-console
  console.log(`semantic-constellation.json: ${puzzles.length} boards (${attempts} attempts), ${(json.length / 1024).toFixed(1)} KiB`);
  for (const p of puzzles.slice(0, 6)) {
    const a = p.answers.filter((x) => x.type === "theme" && x.cluster === "A").map((x) => x.word);
    const b = p.answers.filter((x) => x.type === "theme" && x.cluster === "B").map((x) => x.word);
    const span = p.answers.find((x) => x.type === "spangram")!.word;
    console.log(`  A(${p.anchorA})={${a.join(" ")}} B(${p.anchorB})={${b.join(" ")}} span=${span}`);
  }
}

main();
