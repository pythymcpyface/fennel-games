// Public types for @cic/wordkit.

/** Frequency tiers from SCOWL/wordlist-english: 10 = commonest, 70 = rarest. */
export type FrequencyTier = 10 | 20 | 35 | 40 | 50 | 55 | 60 | 70;

export const ALL_TIERS: readonly FrequencyTier[] = [10, 20, 35, 40, 50, 55, 60, 70];

export interface CorpusOptions {
  /** Only en-GB is supported today; kept explicit for forward-compat. */
  dialect?: "en-GB";
  /** Include words in tiers up to and including this cutoff. Default 35. */
  maxTier?: FrequencyTier;
  /** Inclusive [min, max] word length filter. */
  lengths?: [number, number];
  /** Restrict to /^[a-z]+$/ (no apostrophes, hyphens, digits). Default true. */
  alphaOnly?: boolean;
}

/** The committed corpus data file shape (data/en-GB/corpus.json). */
export interface CorpusData {
  dictionaryId: string;
  version: string;
  dialect: "en-GB";
  /** Words grouped by frequency tier; each word appears in exactly one tier. */
  tiers: Record<string, string[]>;
}

/** Per-target rank table. Matches ladderless's RankTable shape exactly. */
export interface RankTable {
  targetWord: string;
  vocabSize: number;
  /** word -> 1-based rank (1 = target). Covers the whole universe. */
  ranks: Record<string, number>;
  /** ascending rank cutoffs; tier = count of cutoffs < rank. */
  tierCutoffs: number[];
}

/** A similarity source (GloVe cosine in production, stub in tests). */
export interface SimilarityProvider {
  /** Cosine similarity in [-1, 1]; -Infinity if either word is out-of-vocabulary. */
  cosine(a: string, b: string): number;
  has(word: string): boolean;
}

export const DICTIONARY_ID = "wordkit.en-GB.v1";
