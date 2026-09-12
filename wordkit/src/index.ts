// @cic/wordkit — shared British-English word-data package.
export type {
  CorpusData,
  CorpusOptions,
  FrequencyTier,
  RankTable,
  SimilarityProvider,
} from "./types.ts";
export { DICTIONARY_ID, ALL_TIERS } from "./types.ts";

export { loadCorpus, loadCorpusData, wordTier } from "./corpus/load.ts";
export { collectTiers, filterAlphaOnly, filterByLength } from "./corpus/filter.ts";

export { buildRankTable, assertRankTableValid, TIER_COUNT } from "./similarity/rank.ts";
export { loadGloveVectors } from "./similarity/glove.ts";

export { buildEditDistanceGraph } from "./graph/edit-distance.ts";
