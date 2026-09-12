import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, loadGloveVectors, buildRankTable, assertRankTableValid, wordTier, type FrequencyTier } from "../wordkit/src/index.ts";
import { buildPuzzle } from "../src/games/ladderless/content-build.ts";
import { buildPuzzles as buildSeverPuzzles, assertPuzzlesValid as assertSeverValid, type GateModel } from "../src/games/sever/content-build.ts";
import { buildPuzzles as buildAffixPuzzles, assertPuzzlesValid as assertAffixValid } from "../src/games/affix-loom/content-build.ts";
import { buildLengthDataset } from "../src/games/word-morph/content-build.ts";
import { derivePuzzleId, fnv1a32 } from "../src/kit/selection.ts";

// Unified content-dataset generator (gen:data), backed by @cic/wordkit.
//
// Decoupled data (fixes "mounting rejected" + gives real semantic ranks):
//   * ACCEPT-LIST — large en-GB validation dictionary (what guesses are legal).
//   * TARGETS     — small curated answer set (words that get a rank table).
//   * UNIVERSE    — bounded pool each rank table ranks against.
//
// Similarity is real GloVe cosine (glove.6B.50d, build-machine only). The engine
// consumes only integer ranks, so vectors never ship. Valid guesses outside a
// target's universe score worst-rank/"colder" (engine O-1).

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(here, "..", "public");
const GLOVE_PATH = join(here, "..", "wordkit", "vectors", "glove.6B.50d.txt");

const LADDERLESS = {
  packVersion: "2.0.0", // bumped: word set + similarity source changed
  dictionaryId: "wordkit.en-GB.v1",
  days: 365,
  universeCap: 1500,
  targetCap: 200,
};

// Sever: severance-style segmentation puzzles. The player restores the spaces in
// an unspaced compound. Two-word compound seeds where the SPLIT reading is the
// intended (dominant) one. Dictionary + unigram model come from wordkit so the
// dominance gate weighs realistic alternative readings.
const SEVER = {
  packVersion: "2.0.0",
  datasetId: "wordkit.en-GB.v1",
  // Bounded segmentation vocabulary keeps enumerateSegmentations fast and avoids
  // over-ambiguity. Common short words + every phrase token (added below).
  dictTier: 20 as FrequencyTier,
  dictLengths: [2, 8] as [number, number],
  dominanceMargin: 0.15,
  // Compound phrases (space = intended break). Curated; the split reading must win.
  phrases: [
    "A MAN A PLAN", "BED ROOM", "BLACK BIRD", "CO WORKER", "DAY LIGHT",
    "FIRE PLACE", "FOOT BALL", "GOLD FISH", "GREEN HOUSE", "HOT DOG",
    "KEY BOARD", "MOON LIGHT", "NEWS PAPER", "NOTE BOOK", "NO WHERE",
    "PLAY GROUND", "RAIN BOW", "RED CARPET", "SAND CASTLE", "SEA SHORE",
    "SNOW BALL", "SUPER BOWL", "TEA CUP", "TOOTH BRUSH", "WATER FALL",
    "SUN FLOWER", "BOOK CASE", "COW BOY", "DOOR BELL", "FIRE FLY",
  ],
};


/**
 * Deterministically sample `n` items spread across `pool` (not the first n),
 * using an FNV-hash sort so selection is stable but not alphabetically clustered.
 */
function sampleSpread(pool: string[], n: number): string[] {
  if (pool.length <= n) return [...pool];
  return [...pool]
    .sort((a, b) => fnv1a32(a) - fnv1a32(b))
    .slice(0, n)
    .sort();
}

function buildLadderless(): void {
  if (!existsSync(GLOVE_PATH)) {
    throw new Error(
      `GloVe vectors not found at ${GLOVE_PATH}. Run \`npm run fetch-glove\` in wordkit/ first.`,
    );
  }
  const provider = loadGloveVectors(GLOVE_PATH);

  const acceptList = loadCorpus({ maxTier: 40, lengths: [3, 12] });
  // Universe: common words present in GloVe, spread across the alphabet (not the
  // first N) so rank-table neighbours aren't biased toward early-alphabet words.
  const universe = sampleSpread(
    loadCorpus({ maxTier: 35, lengths: [3, 10] }).filter((w) => provider.has(w)),
    LADDERLESS.universeCap,
  );
  const universeSet = new Set(universe);
  // Targets: common, in-universe words, spread deterministically across the range.
  const targets = sampleSpread(
    loadCorpus({ maxTier: 20, lengths: [4, 8] }).filter((w) => provider.has(w) && universeSet.has(w)),
    LADDERLESS.targetCap,
  );
  if (targets.length === 0) throw new Error("ladderless: no eligible targets");

  const rankTables: Record<string, ReturnType<typeof buildRankTable>> = {};
  for (const t of targets) {
    const table = buildRankTable(t, universe, provider);
    assertRankTableValid(table, universe.filter((w) => w !== t));
    rankTables[t] = table;
  }

  const puzzles: Record<string, ReturnType<typeof buildPuzzle>> = {};
  for (let i = 0; i < LADDERLESS.days; i++) {
    const puzzleId = `puz-${i.toString().padStart(4, "0")}`;
    const target = targets[i % targets.length];
    const table = rankTables[target];
    let startWord = target;
    let worst = -1;
    for (const w of universe) {
      if (w === target) continue;
      const r = table.ranks[w];
      if (r > worst) {
        worst = r;
        startWord = w;
      }
    }
    puzzles[puzzleId] = buildPuzzle(puzzleId, startWord, target, table);
  }

  const pack = {
    contentPackVersion: LADDERLESS.packVersion,
    dictionaryId: LADDERLESS.dictionaryId,
    puzzleCount: LADDERLESS.days,
    // `vocabulary` = the rank-table universe (field name kept for back-compat).
    vocabulary: universe,
    // `acceptList` = the large validation dictionary (decoupled).
    acceptList,
    puzzles,
    rankTables,
    // sanity linkage: verify today resolves to a real puzzle.
    _example: derivePuzzleId("2024-04-01", LADDERLESS.packVersion, LADDERLESS.dictionaryId, LADDERLESS.days),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const json = JSON.stringify(pack);
  writeFileSync(join(OUT_DIR, "ladderless.json"), json);
  // eslint-disable-next-line no-console
  console.log(
    `ladderless.json: ${acceptList.length} accept-list, ${universe.length} universe, ` +
      `${targets.length} targets, ${LADDERLESS.days} puzzles, ${(json.length / 1024 / 1024).toFixed(2)} MiB`,
  );
}

function buildSever(): void {
  // Segmentation vocabulary: common short words (uppercased) + every phrase token,
  // so the dominance gate has realistic alternative readings to weigh against.
  const phraseTokens = new Set(
    SEVER.phrases.flatMap((p) => p.trim().toUpperCase().split(/\s+/)),
  );
  const common = loadCorpus({ maxTier: SEVER.dictTier, lengths: SEVER.dictLengths }).map((w) =>
    w.toUpperCase(),
  );
  const dictionary = new Set<string>([...common, ...phraseTokens]);

  // Unigram model from wordkit frequency tiers: commoner word => higher score.
  // Score = (80 - tier)/10 so tier-10 words ≈ 7.0, tier-70 ≈ 1.0. Phrase tokens
  // absent from the corpus get a small floor so the intended reading still scores.
  const unigram: Record<string, number> = {};
  for (const w of dictionary) {
    const tier = wordTier(w.toLowerCase());
    unigram[w] = tier === null ? 1.5 : (80 - tier) / 10;
  }

  // Bigram model: reward each intended adjacent token pair so the split reading
  // dominates the single-compound reading (which has no bigram bonus).
  const bigram: Record<string, number> = {};
  for (const phrase of SEVER.phrases) {
    const toks = phrase.trim().toUpperCase().split(/\s+/);
    for (let i = 1; i < toks.length; i++) bigram[`${toks[i - 1]} ${toks[i]}`] = 2;
  }

  const model: GateModel = { unigram, bigram, dominanceMargin: SEVER.dominanceMargin };

  const puzzles = buildSeverPuzzles(SEVER.phrases, dictionary, model);
  assertSeverValid(puzzles, dictionary);
  if (puzzles.length === 0) throw new Error("sever: no phrases passed the dominance gate");

  const pack = {
    contentPackVersion: SEVER.packVersion,
    datasetId: SEVER.datasetId,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC",
    dictionary: [...dictionary].sort(),
    puzzles,
  };

  const json = JSON.stringify(pack);
  writeFileSync(join(OUT_DIR, "sever.json"), json);
  // eslint-disable-next-line no-console
  console.log(
    `sever.json: ${dictionary.size} dictionary, ${puzzles.length}/${SEVER.phrases.length} phrases passed gate, ` +
      `${(json.length / 1024).toFixed(1)} KiB`,
  );
}

// Affix Loom: weave prefixes/suffixes onto a base to build the day's word. The
// affix inventory + daily targets are curated in the game's content-build; the
// LEXICON (real-word accept-list) comes from wordkit (en-GB) so guesses like
// "mounting" validate. Targets are unioned in to guarantee the fairness gate.
const AFFIX_LOOM = {
  packVersion: "1.0.0",
  datasetId: "wordkit.en-GB.v1",
  lexTier: 40 as FrequencyTier,
  lexLengths: [3, 20] as [number, number],
};

function buildAffixLoom(): void {
  const puzzles = buildAffixPuzzles();
  const targetSurfaces = puzzles.map((p) => p.target_specs[0].surface);
  const lexicon = new Set<string>([
    ...loadCorpus({ maxTier: AFFIX_LOOM.lexTier, lengths: AFFIX_LOOM.lexLengths }),
    ...targetSurfaces,
  ]);
  assertAffixValid(puzzles, lexicon);
  if (puzzles.length === 0) throw new Error("affix-loom: no puzzles");

  const pack = {
    contentPackVersion: AFFIX_LOOM.packVersion,
    datasetId: AFFIX_LOOM.datasetId,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC",
    lexicon: [...lexicon].sort(),
    puzzles,
  };

  const json = JSON.stringify(pack);
  writeFileSync(join(OUT_DIR, "affix-loom.json"), json);
  // eslint-disable-next-line no-console
  console.log(
    `affix-loom.json: ${lexicon.size} lexicon, ${puzzles.length} puzzles, ` +
      `${(json.length / 1024 / 1024).toFixed(2)} MiB`,
  );
}

// Word Morph: daily word-ladder. One dataset per word length, all built from
// wordkit's en-GB corpus (loadCorpus) so the dictionary is large and consistent
// with the rest of the hub — replaces the standalone's curated words-*.txt.
const WORD_MORPH = {
  packVersion: "2.0.0", // bumped: word set now sourced from wordkit
  datasetId: "wordkit.en-GB.v1",
  lengths: [4, 5, 6, 7] as const,
  defaultWordLength: 4,
  // Common enough to be recognisable, broad enough for a connected ladder graph.
  corpusMaxTier: 40 as FrequencyTier,
};

function buildWordMorph(): void {
  const denylist = new Set<string>();
  const lengths = WORD_MORPH.lengths.map((len) => {
    const words = loadCorpus({ maxTier: WORD_MORPH.corpusMaxTier, lengths: [len, len] });
    const ds = buildLengthDataset(words, denylist, len);
    // eslint-disable-next-line no-console
    console.log(`  word-morph len ${len}: ${ds.dictionaryWords.length} words, ${ds.candidatePairs.length} pairs, ${ds.componentCount} components`);
    return ds;
  });

  const pack = {
    contentPackVersion: WORD_MORPH.packVersion,
    datasetId: WORD_MORPH.datasetId,
    defaultWordLength: WORD_MORPH.defaultWordLength,
    lengths,
  };

  const json = JSON.stringify(pack);
  writeFileSync(join(OUT_DIR, "word-morph.json"), json);
  // eslint-disable-next-line no-console
  console.log(`word-morph.json: ${lengths.length} lengths, ${(json.length / 1024 / 1024).toFixed(2)} MiB`);
}

function main(): void {
  buildLadderless();
  buildSever();
  buildAffixLoom();
  buildWordMorph();
}

main();
