# wordkit — Shared British-English Word Data Package

**Status:** DRAFT — awaiting sign-off. No implementation code exists yet.
**Location:** `/Users/andrewgibson/Projects/cic/wordkit/`
**Consumers:** `ladderless`, `word-morph`, `overlap`, `affix-loom`, `word-connections` (and future word games).

---

## 1. Problem & Goal

Every word game under `cic/` re-curates its own vocabulary. They are inconsistent
(American vs British vs mixed), small, and each re-solves the same problems
(validation lists, frequency filtering, similarity/relationship data). The
originating complaint — real words like `mounting` rejected — is a symptom of a
140-word curated list.

**Goal:** one shared, versioned, British-English word-data package that provides:

1. **A large en-GB validation corpus** (accept/reject typed guesses).
2. **Frequency banding** (filter "common" from "obscure" without re-curation).
3. **Build-time primitives** for the three data shapes games actually need:
   validation lists, word-relationship graphs, and semantic rank tables.
4. **Semantic similarity** powered by pre-trained GloVe vectors, emitted as
   compact integer rank tables (vectors never ship).

**Non-goals:** shipping raw embeddings to browsers; training embeddings;
becoming a monorepo; rewriting games that don't need it. Migration is opt-in,
one game at a time.

---

## 2. Verified Facts (from investigation, not assumptions)

### 2.1 Environment
- Parent `cic/` is **NOT** a git repo or monorepo workspace — just a directory
  of independent projects.
- All word games are **ESM TypeScript + Vite + npm**, `"type": "module"`.
- Consumption mechanism: **`file:` dependency** (`"@cic/wordkit": "file:../wordkit"`).
  Zero registry, zero new tooling.

### 2.2 Corpus source — `wordlist-english` (npm)
- 1.5 MB unpacked, MIT licence, derived from **SCOWL** (`wordlist.aspell.net`).
- Pre-split by **dialect** (`english` neutral, `american`, `british`, `canadian`,
  `australian`) AND by **frequency tier** (`10,20,35,40,50,55,60,70`;
  10 = commonest, 70 = rarest/archaic).
- British-exclusive spellings confirmed present: `colour, behaviour, defence,`
  `centre, cheque, favourite`.
- Real cumulative en-GB counts (english + british, deduped):

  | Freq cutoff | Words | Intended use |
  |-------------|-------|--------------|
  | ≤ tier 20 | 10,936 | target/answer words |
  | ≤ tier 35 | 39,189 | strict accept-list |
  | ≤ tier 50 | 61,626 | medium accept-list |
  | ≤ tier 70 (all) | 111,676 | permissive accept-list |
  | a–z only, length 3–8 | 53,598 | typical game-usable subset |

- **Frequency data needs no separate download** — the 8 tiers ARE the frequency
  bands. (A true corpus-frequency ranking like SUBTLEX is a future nice-to-have,
  not required.)

### 2.3 Embeddings — pre-trained GloVe (download, do NOT generate)
- We **download** finished vectors. We never train.
- `glove.6B.zip`: **862 MB**, one-time, build-machine only.
  - Primary: `https://nlp.stanford.edu/data/glove.6B.zip`
    (301 → `downloads.cs.stanford.edu`).
  - Fallback: Hugging Face `stanfordnlp/glove` (same file).
  - Public domain (PDDL v1.0).
- Unzip → keep only `glove.6B.50d.txt` (~171 MB), discard the zip + other dims.
- Format: plain text, one line per word: `word f1 f2 … f50`.
- **Nothing embedding-related ships to games.** wordkit reads the txt at build
  time, computes cosine similarity, emits **integer rank tables** only.
- 50d chosen: smallest usable; adequate for common-word similarity. 100d is a
  drop-in upgrade later (same 862 MB download).

### 2.4 The decoupling requirement (architectural)
`ladderless/src/content/build.ts:24` `buildRankTable` ranks the **entire
vocabulary** against each target → storage is O(targets × vocabulary). This is
why validation and ranking MUST be separated:

- **Validation list** (accept guesses) → can be 40k–110k, cheap (a `Set`).
- **Target/rank set** (words that get rank tables) → MUST stay small (hundreds).
- **Rank-table universe** (words ranked *within* each table) → the candidate
  pool a guess is scored against; a bounded subset (e.g. top-N by frequency),
  NOT the full accept-list.

Conflating these is the current design's core limitation.

---

## 3. Package Architecture

```
wordkit/
  package.json            # name "@cic/wordkit", type module, exports map
  tsconfig.json
  README.md
  .gitignore              # vectors/, .cache/, downloaded corpora
  scripts/
    fetch-glove.ts        # download + unzip glove.6B.zip -> vectors/glove.6B.50d.txt
    build-corpus.ts       # wordlist-english -> data/en-GB/*.json (tiered)
  vectors/                # (gitignored) downloaded glove.6B.50d.txt
  data/
    en-GB/
      corpus.json         # { dictionaryId, version, dialect, tiers, words[] }
      meta.json           # counts, checksums, source provenance
  src/
    index.ts              # public API barrel
    corpus/
      load.ts             # loadCorpus({ dialect, maxTier, lengths, alphaOnly })
      filter.ts           # filterByTier, filterByLength, applyDenylist, alphaOnly
    similarity/
      glove.ts            # loadVectors(path), cosine(a,b), SimilarityProvider
      rank.ts             # buildRankTable(target, universe, provider) -> ranks
    graph/
      edit-distance.ts    # one-letter-change adjacency (word-morph)
      primitives.ts       # generic bipartite/graph helpers (overlap)
    pack/
      envelope.ts         # { dictionaryId, version, ... } schema + validator
      loader.ts           # runtime loadPack() + schema validation (AssetPort-friendly)
    types.ts
  test/                   # vitest unit tests per module
```

### 3.1 Three layers (map to the three real needs)

**Layer 1 — Base corpus (data).** `data/en-GB/corpus.json`: the tiered en-GB word
list, generated once by `scripts/build-corpus.ts` from `wordlist-english`,
committed to the repo (small, ~1–2 MB JSON). This is the single source of truth.

**Layer 2 — Build primitives (library, imported at build time).** Pure TS
functions games call in their own `tools/build-*.ts`:
- `loadCorpus(opts)` → filtered word list (dialect, tier, length, alpha-only).
- `SimilarityProvider` from GloVe: `loadVectors(path)` → `cosine(a,b)`.
- `buildRankTable(target, universe, provider)` — lifted/generalised from
  ladderless `build.ts`, but the **universe is a passed-in bounded set**, not the
  whole dictionary.
- `buildEditDistanceGraph`, graph primitives — for word-morph / overlap.

**Layer 3 — Runtime loader (tiny, optional).** `loadPack()` + schema validator so
games fetch versioned packs the same way (drop-in for the `AssetPort.loadText`
pattern ladderless/overlap already use). Games keep their own pack shapes; this
just standardises envelope + validation.

### 3.2 Public API (initial surface)

```ts
// @cic/wordkit
export interface CorpusOptions {
  dialect?: "en-GB";           // only en-GB for now
  maxTier?: number;            // 10..70; default 35
  lengths?: [number, number];  // inclusive [min,max]
  alphaOnly?: boolean;         // /^[a-z]+$/ ; default true
}
export function loadCorpus(opts?: CorpusOptions): string[];

export interface SimilarityProvider {
  cosine(a: string, b: string): number;   // NaN-safe: missing word => -Infinity
  has(word: string): boolean;
}
export function loadGloveVectors(path: string): SimilarityProvider;

export interface RankTable {                // matches ladderless shape
  targetWord: string;
  vocabSize: number;
  ranks: Record<string, number>;
  tierCutoffs: number[];
}
export function buildRankTable(
  targetWord: string,
  universe: readonly string[],             // bounded candidate pool, NOT accept-list
  provider: SimilarityProvider,
  tierCount?: number,
): RankTable;

export function buildEditDistanceGraph(words: readonly string[]): Map<string, string[]>;

export const DICTIONARY_ID = "wordkit.en-GB.v1";
```

Design guarantees carried over from ladderless: deterministic
(lexicographic tie-break), integer-rank output only, coverage-gated.

---

## 4. Distribution & Versioning

- **No registry.** Each consuming game adds `"@cic/wordkit": "file:../wordkit"`.
- `dictionaryId = "wordkit.en-GB.v1"` — the stable interface. Games key their
  determinism/seeds on it (all four already key on a `dictionaryId`).
- Semver on the package; bump `dictionaryId` version suffix only when the
  **word set** changes (which invalidates downstream rank tables/graphs).
- wordkit ships committed `data/en-GB/corpus.json` so `npm install` alone is
  enough for corpus access. Embeddings are the only extra step, and only for
  games that need semantic ranks (`npm run fetch-glove` once).

---

## 5. Build Pipeline (wordkit itself)

```
npm run fetch-corpus   # wordlist-english -> data/en-GB/corpus.json (committed)
npm run fetch-glove    # download 862MB zip -> vectors/glove.6B.50d.txt (gitignored)
npm test               # vitest: corpus filters, cosine, rank determinism, coverage
```

`fetch-glove` is idempotent: skips if the txt already exists + checksum matches.

---

## 6. ladderless Migration (first consumer — the original request)

**Objective:** replace the 140-word list with a real en-GB corpus + real semantic
ranking, and fix `mounting`-style rejections by decoupling validation from targets.

### 6.1 Changes
1. Add `"@cic/wordkit": "file:../wordkit"` to `ladderless/package.json`.
2. **Rewrite `tools/build-dataset.ts`:**
   - `acceptList = loadCorpus({ maxTier: 50, lengths: [3, 12] })` (~60k words) →
     becomes the guess-validation dictionary.
   - `targets = loadCorpus({ maxTier: 20, lengths: [4, 8] })` sampled/curated to
     a few hundred answers.
   - `universe = loadCorpus({ maxTier: 35, lengths: [3, 10] })` capped (e.g.
     top ~2,000 by tier) — the pool each rank table ranks against.
   - `provider = loadGloveVectors("../wordkit/vectors/glove.6B.50d.txt")`.
   - `buildRankTable(target, universe, provider)` for each target → real
     semantic ranks (rock ≈ stone).
3. **Decouple validation in the pack + controller:**
   - `content-pack.json` gains a separate `acceptList` (large) distinct from
     `rankTables` universe (bounded).
   - `controller.ts:49` builds `this.dictionary = new Set(pack.acceptList)` so
     validation accepts the large list; ranking still uses per-target tables.
   - Guesses not in a target's rank-table universe still score (mapped to worst
     tier) — design detail to finalise in implementation (see §8 open item O-1).
4. Bump `contentPackVersion` and `dictionaryId` → engine untouched (consumes
   integer ranks only, per existing ADR).

### 6.2 What this fixes
- `mounting`, `mount`, etc. accepted (in the 60k accept-list).
- Warmer/colder becomes **semantic**, not spelling-based.
- Pack stays small: ranks are integers; universe is bounded, not 60k.

### 6.3 Tests
- Existing 64 tests must stay green (engine/persistence/controller unchanged).
- New: accept-list contains `mounting`; a known synonym pair ranks closer than a
  known unrelated pair (semantic sanity); pack size within budget.

---

## 7. Rollout Order

| Phase | Work | Gate |
|-------|------|------|
| P0 | Scaffold wordkit; `fetch-corpus`; commit `corpus.json`; corpus API + tests | corpus filters tested |
| P1 | `fetch-glove`; GloVe provider + `buildRankTable`; determinism/coverage tests | semantic ranks proven |
| P2 | Migrate **ladderless** (§6); decouple accept-list; all tests green | mounting accepted, semantic warmer/colder |
| P3 | `buildEditDistanceGraph`; migrate **word-morph** to en-GB corpus | word-morph builds from wordkit |
| P4 | overlap / affix-loom / word-connections (opt-in, as needed) | per-game |

Each phase is independently shippable. Only P0–P2 are in scope for the initial
implementation; P3+ are follow-ups.

---

## 8. Risks & Open Items

| ID | Item | Resolution |
|----|------|-----------|
| R-1 | 862 MB GloVe download | one-time, gitignored, checksum-cached, build-machine only |
| R-2 | Corpus quality (tier-70 archaic words) | default `maxTier: 50`; games opt into wider |
| R-3 | GloVe missing a corpus word (OOV) | `cosine` returns `-Infinity`; word ranked worst; logged at build |
| R-4 | British-exclusive words absent from GloVe (uncased, US-trained) | acceptable: British spellings still validate; ranking falls back to worst tier; document |
| O-1 | Guess outside a target's bounded rank-universe: how to score? | **DECIDE IN IMPL** — proposal: map to worst existing tier + announce "colder"; keep deterministic |
| O-2 | corpus.json committed size (~1–2 MB) | acceptable; alternative = ship per-tier files, load lazily |
| O-3 | Licence attribution (SCOWL, GloVe) | include NOTICE with SCOWL copyright + GloVe PDDL |

---

## 9. Sign-off Checklist

- [ ] Package location `cic/wordkit/` and `file:` distribution approved
- [ ] Corpus source `wordlist-english` (SCOWL, en-GB, tiered) approved
- [ ] GloVe 6B 50d download-only approach approved
- [ ] Decoupling of accept-list vs target/universe approved
- [ ] Rollout scope: implement **P0–P2** now (wordkit + ladderless), defer P3+
- [ ] Open item O-1 (out-of-universe guess scoring) — approve proposed default
```
