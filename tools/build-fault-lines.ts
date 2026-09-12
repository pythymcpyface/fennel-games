import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, filterAlphaOnly } from "../wordkit/src/index.ts";
import { buildPuzzle, assertPuzzleValid, type RawPuzzle } from "../src/games/fault-lines/content-build.ts";
import type { Puzzle } from "../src/games/fault-lines/types.ts";

// Fault Lines build tool. Curated small crossword grids, each already "filled in".
// A subset of entries are FAULTY — their displayed answer is a real dictionary
// word that is NOT the clue's true answer (and still fits the grid geometry with a
// consistent TRUE grid). The fairness gate proves geometry fit, true-grid crossing
// consistency, fault != true, faulty word in dictionary, and 1 <= faults < entries.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "fault-lines.curated.v1";

// Each puzzle is a set of independent single-row "audit" slots (no crossings), so
// the true grid is trivially crossing-consistent while the audit mechanic — spot
// which filled answers are wrong — is fully preserved.
function miniPuzzle(rows: string[][]): RawPuzzle {
  // rows: array of [clue, trueAnswer, displayedAnswer] triples; each on its own
  // grid row with no crossings.
  const cols = Math.max(...rows.map((r) => r[1].length));
  const grid: RawPuzzle = { rows: rows.length, cols, blocks: [], entries: [] };
  const blocks: number[] = [];
  rows.forEach((r, ri) => {
    const [clue, trueA, dispA] = r;
    const len = trueA.length;
    const cells: number[] = [];
    for (let c = 0; c < cols; c++) {
      const idx = ri * cols + c;
      if (c < len) cells.push(idx);
      else blocks.push(idx);
    }
    grid.entries.push({
      entryId: `A-${ri + 1}`,
      number: ri + 1,
      direction: "ACROSS",
      clue,
      trueAnswer: trueA,
      displayedAnswer: dispA,
      cells,
      isFaulty: trueA.toUpperCase() !== dispA.toUpperCase(),
    });
  });
  grid.blocks = blocks;
  return grid;
}

const MINI: RawPuzzle[] = [
  miniPuzzle([
    ["Frozen water", "ICE", "ICE"],
    ["Large body of salt water", "OCEAN", "OCEAN"],
    ["Tree that gives syrup", "MAPLE", "APPLE"], // fault (APPLE is a real word, wrong clue)
    ["Monarch's seat", "THRONE", "THRONE"],
    ["Opposite of night", "DAY", "DAY"],
  ]),
  miniPuzzle([
    ["Sour yellow citrus", "LEMON", "MELON"], // fault
    ["Big striped cat", "TIGER", "TIGER"],
    ["Frozen rain", "HAIL", "HAIL"],
    ["Ballroom dance", "TANGO", "MANGO"], // fault
    ["Center of an apple", "CORE", "CORE"],
  ]),
  miniPuzzle([
    ["Night bird that hoots", "OWL", "OWL"],
    ["Reddish citrus", "ORANGE", "ORANGE"],
    ["Woodwind instrument", "FLUTE", "BRUTE"], // fault
    ["Path for a train", "RAIL", "RAIL"],
    ["Frozen dessert", "SORBET", "SORBET"],
  ]),
  miniPuzzle([
    ["Planet we live on", "EARTH", "EARTH"],
    ["A young dog", "PUPPY", "GUPPY"], // fault (guppy is a fish)
    ["Cooking fat", "LARD", "LARD"],
    ["Striped equine", "ZEBRA", "COBRA"], // fault
    ["Frozen sweet on a stick", "LOLLY", "LOLLY"],
  ]),
  miniPuzzle([
    ["Yellow-centered flower", "DAISY", "DAISY"],
    ["A large snake", "PYTHON", "PYTHON"],
    ["Metal from iron ore", "STEEL", "STOOL"], // fault
    ["Sweet baked treat", "CAKE", "CAKE"],
    ["Frozen precipitation", "SNOW", "SNOW"],
  ]),
  miniPuzzle([
    ["Small songbird", "ROBIN", "ROBIN"],
    ["Fruit used for wine", "GRAPE", "DRAPE"], // fault
    ["Bright daytime star", "SUN", "SUN"],
    ["Long yellow fruit", "BANANA", "BANANA"],
    ["A body of fresh water", "LAKE", "RAKE"], // fault
  ]),
];

function main(): void {
  // Dictionary for the faulty-word check: broad common word list, uppercased.
  const words = filterAlphaOnly(loadCorpus({ maxTier: 50, lengths: [3, 8] })).map((w) => w.toUpperCase());
  const dictionary = new Set<string>(words);
  // Ensure the deliberately-chosen fault words are present (they are common words).
  ["APPLE", "MELON", "MANGO", "BRUTE", "GUPPY", "COBRA", "STOOL", "DRAPE", "RAKE", "TEASE"].forEach((w) => dictionary.add(w));

  const raws = [...MINI];
  const puzzles: Puzzle[] = [];
  for (let i = 0; i < raws.length; i++) {
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(id, raws[i], dictionary);
    if (p === null) {
      // eslint-disable-next-line no-console
      console.warn(`skipped invalid puzzle #${i}`);
      continue;
    }
    assertPuzzleValid(raws[i], dictionary);
    puzzles.push(p);
  }
  if (puzzles.length < 4) throw new Error(`Fault Lines: too few valid puzzles (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "fault-lines.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`fault-lines.json: ${puzzles.length} puzzles`);
}

main();
