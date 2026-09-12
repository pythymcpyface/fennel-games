# Glossary

## Terms

### TERM-001: Puzzle
- **Definition:** The deterministic daily semantic word challenge consisting of a **START word** (TERM-003), a hidden **TARGET word** (TERM-004), and the rules for evaluating **guesses** (TERM-005) using a **rank table** (TERM-008).
- **Synonyms:** daily puzzle, daily challenge
- **Anti-definition:** Not a randomized session; not user-specific content; not server-delivered at play time.
- **Source:** User request

### TERM-002: Day
- **Definition:** A calendar day identifier used to select the daily **Puzzle** (TERM-001) deterministically.
- **Synonyms:** date, dayId
- **Anti-definition:** Not a timestamp with time-of-day precision; not locale-dependent once normalized.
- **Source:** User request

### TERM-003: START Word
- **Definition:** The visible initial word for the daily **Puzzle** (TERM-001) from which players begin making **guesses** (TERM-005).
- **Synonyms:** start, seed word
- **Anti-definition:** Not the hidden answer; not dynamically generated at runtime.
- **Source:** User request

### TERM-004: TARGET Word
- **Definition:** The hidden answer word for the daily **Puzzle** (TERM-001); the player wins by guessing it exactly.
- **Synonyms:** answer, goal word
- **Anti-definition:** Not revealed during play except upon win or explicit reveal action (if provided).
- **Source:** User request

### TERM-005: Guess
- **Definition:** A player-entered word candidate evaluated against the daily **TARGET word** (TERM-004) using the on-device **rank table** (TERM-008).
- **Synonyms:** attempt, entered word
- **Anti-definition:** Not a partial string; not an out-of-dictionary token.
- **Source:** User request

### TERM-006: Vocabulary Word
- **Definition:** A word contained in the curated dictionary for a given **Dictionary ID** (TERM-013) and eligible as a **Guess** (TERM-005).
- **Synonyms:** dictionary word
- **Anti-definition:** Not arbitrary user text; not a phrase; not a word from a different dictionary version.
- **Source:** User request

### TERM-007: Semantic Similarity Rank
- **Definition:** A deterministic integer ordering of a **Vocabulary Word** (TERM-006) relative to the **TARGET word** (TERM-004), where lower rank indicates closer similarity.
- **Synonyms:** rank, closeness rank
- **Anti-definition:** Not a floating-point cosine similarity computed at runtime; not platform-dependent.
- **Source:** User request

### TERM-008: Per-Target Rank Table
- **Definition:** A compact build-time-generated lookup mapping each **Vocabulary Word** (TERM-006) to its **Semantic Similarity Rank** (TERM-007) and **Rank Tier** (TERM-009) for a specific **TARGET word** (TERM-004), packaged with the app for offline runtime use.
- **Synonyms:** rank table, lookup table, precomputed table
- **Anti-definition:** Not generated on device; not fetched from a server during play.
- **Source:** User request

### TERM-009: Rank Tier
- **Definition:** A categorical bucket derived from **Semantic Similarity Rank** (TERM-007) used for feedback to the player without revealing exact closeness.
- **Synonyms:** tier, tier bucket
- **Anti-definition:** Not a continuous score; not a color-only indicator.
- **Source:** User request

### TERM-010: Warmer/Colder Verdict
- **Definition:** The feedback for a **Guess** (TERM-005) indicating whether its **Semantic Similarity Rank** (TERM-007) is better (warmer) or worse (colder) than the player’s prior **Best Rank** (TERM-011).
- **Synonyms:** warmer/colder, hot/cold feedback
- **Anti-definition:** Not relative to immediately previous guess; not based on distance to START word.
- **Source:** User request

### TERM-011: Best Rank
- **Definition:** The best (lowest) **Semantic Similarity Rank** (TERM-007) achieved so far in the current **Puzzle** (TERM-001).
- **Synonyms:** personal best rank, current best
- **Anti-definition:** Not global leaderboard; not persisted across puzzles as a single value.
- **Source:** User request

### TERM-012: Par
- **Definition:** A build-time precomputed baseline guess count for the daily **Puzzle** (TERM-001) used for scoring comparison.
- **Synonyms:** par guesses, baseline
- **Anti-definition:** Not player-specific; not computed at runtime.
- **Source:** User request

### TERM-013: Dictionary
- **Definition:** The curated set of **Vocabulary Words** (TERM-006) used for validation and rank-table indexing.
- **Synonyms:** wordlist, lexicon
- **Anti-definition:** Not OS spellcheck; not a third-party online dictionary.
- **Source:** User request

### TERM-014: Dictionary ID
- **Definition:** The identifier for a specific **Dictionary** (TERM-013) version used in deterministic daily selection and compatibility with **rank tables** (TERM-008).
- **Synonyms:** dictId
- **Anti-definition:** Not a locale alone; not a build number without semantic meaning.
- **Source:** User request

### TERM-015: Content Pack
- **Definition:** The shipped set of daily puzzles and required assets, including **START/TARGET** pairs, **Par** (TERM-012), and **Per-Target Rank Tables** (TERM-008).
- **Synonyms:** puzzle pack
- **Anti-definition:** Not downloaded at play time; not user-generated.
- **Source:** User request

### TERM-016: Content Pack Version
- **Definition:** A version identifier for the **Content Pack** (TERM-015) used as an input to deterministic selection and stability across releases.
- **Synonyms:** pack version
- **Anti-definition:** Not the app version; not device OS version.
- **Source:** User request

### TERM-017: Deterministic Daily Selection
- **Definition:** The algorithm that maps (**Day ID**, **Content Pack Version**, **Dictionary ID**) to the selected daily **Puzzle** (TERM-001) such that the same inputs yield the same output across platforms and time.
- **Synonyms:** daily picker, daily selection
- **Anti-definition:** Not randomness from device entropy; not server-assigned.
- **Source:** User request

### TERM-018: Seedable Hash
- **Definition:** The pure deterministic hash function used by **Deterministic Daily Selection** (TERM-017) over canonicalized inputs.
- **Synonyms:** hash, selection hash
- **Anti-definition:** Not crypto proof-of-work; not non-deterministic PRNG.
- **Source:** User request

### TERM-019: Offline-First
- **Definition:** The constraint that the game is fully playable without network connectivity, including puzzle selection, validation, evaluation, and persistence.
- **Synonyms:** offline, no-backend play
- **Anti-definition:** Not “offline-capable but requires initial fetch”; not cloud-synced accounts.
- **Source:** User request

### TERM-020: Local Persistence
- **Definition:** On-device storage of game state, stats, and settings using platform-appropriate storage adapters.
- **Synonyms:** device storage, local save
- **Anti-definition:** Not server storage; not shared between devices.
- **Source:** User request

### TERM-021: Game State
- **Definition:** The persisted representation of the in-progress daily **Puzzle** (TERM-001) including **guess history** and current **Best Rank** (TERM-011).
- **Synonyms:** session state, run state
- **Anti-definition:** Not analytics telemetry; not remote state.
- **Source:** User request

### TERM-022: Stats
- **Definition:** Aggregated local metrics per user/device such as wins, guess counts, and streaks.
- **Synonyms:** local stats
- **Anti-definition:** Not leaderboards; not shared publicly unless user shares manually.
- **Source:** User request

### TERM-023: Streak
- **Definition:** Count of consecutive **Days** (TERM-002) where the daily **Puzzle** (TERM-001) was completed successfully.
- **Synonyms:** win streak
- **Anti-definition:** Not hours-played; not dependent on continuous app usage.
- **Source:** User request

### TERM-024: Share Artifact
- **Definition:** A spoiler-safe text/emoji grid summarizing results using warm/cold blocks and a terminal star without revealing the **TARGET word** (TERM-004).
- **Synonyms:** emoji share, share grid
- **Anti-definition:** Not an image that includes the answer; not a link requiring a backend.
- **Source:** User request

### TERM-025: Hint
- **Definition:** A user-invoked assist that reveals a next **Vocabulary Word** (TERM-006) whose rank is strictly better than the current **Best Rank** (TERM-011) for the current **Puzzle** (TERM-001).
- **Synonyms:** nudge, next warmer word
- **Anti-definition:** Not revealing the TARGET directly (unless it is the only improvement).
- **Source:** User request

### TERM-026: Deterministic Functional Core
- **Definition:** Pure logic module that computes selection, validation, evaluation, hinting, and state transitions without side effects (no storage, no clock, no network).
- **Synonyms:** core engine, pure core
- **Anti-definition:** Not the UI; not adapters; not platform-specific APIs.
- **Source:** User request

### TERM-027: Platform Adapter
- **Definition:** Thin layer providing side-effecting services (clock, storage, share, asset loading) to the **Deterministic Functional Core** (TERM-026).
- **Synonyms:** adapter, port
- **Anti-definition:** Not business logic; not puzzle evaluation rules.
- **Source:** User request

### TERM-028: Composition Root
- **Definition:** Per-platform wiring that selects and configures the **Platform Adapter** (TERM-027) for PWA vs Capacitor iOS/Android.
- **Synonyms:** bootstrap, platform composition
- **Anti-definition:** Not runtime feature flags from a server.
- **Source:** User request

### TERM-029: PWA
- **Definition:** Installable Progressive Web App distribution of the game using web storage mechanisms.
- **Synonyms:** web app
- **Anti-definition:** Not native app packaging; not requiring app store distribution.
- **Source:** User request

### TERM-030: Capacitor App
- **Definition:** iOS/Android app wrapper distribution using Capacitor APIs for storage and OS integrations.
- **Synonyms:** native wrapper app
- **Anti-definition:** Not separate native codebases per platform for game logic.
- **Source:** User request

### TERM-031: Accessibility Support
- **Definition:** Features enabling keyboard operation, screen reader announcements, and non-color-only feedback for **Warmer/Colder Verdict** (TERM-010) and **Rank Tier** (TERM-009).
- **Synonyms:** a11y
- **Anti-definition:** Not optional “nice to have” without acceptance criteria.
- **Source:** User request

### TERM-032: Build-Time Content Generation
- **Definition:** Offline pipeline that produces **Content Pack** (TERM-015) artifacts (targets, start words, rank tables, par) from curated wordlist and a source embedding.
- **Synonyms:** content build pipeline
- **Anti-definition:** Not on-device generation; not runtime ML inference.
- **Source:** User request

### TERM-033: Solvability Check
- **Definition:** Build-time verification that each daily **TARGET word** (TERM-004) is reachable and has a smooth enough rank gradient for enjoyable play.
- **Synonyms:** reachability check, quality gate
- **Anti-definition:** Not a runtime check; not manual playtesting only.
- **Source:** User request

## Data Dictionary

| ID | Name | Type | Format | Range/Enum | Units | Default | Nullable | PII | Source | Validation |
|---|---|---|---|---|---|---|---|---|---|---|
| FIELD-001 | dayId | string | `YYYY-MM-DD` (Gregorian) | valid date | n/a | device “today” | false | None | Platform Adapter (clock) | Must parse as ISO date; must be canonicalized to UTC day boundary rule |
| FIELD-002 | contentPackVersion | string | semver-like | pattern `^\d+\.\d+\.\d+` | n/a | bundled value | false | None | Content Pack | Must equal packaged metadata version |
| FIELD-003 | dictionaryId | string | token | `[a-z0-9._-]+` | n/a | bundled value | false | None | Content Pack | Must match rank-table dictionary id |
| FIELD-004 | puzzleId | string | token | `[a-z0-9._-]+` | n/a | derived | false | None | Deterministic Functional Core | Must be stable for same (FIELD-001,2,3) |
| FIELD-005 | startWord | string | lowercase | in Dictionary | n/a | derived | false | None | Content Pack | Must exist in Dictionary (TERM-013) |
| FIELD-006 | targetWord | string | lowercase | in Dictionary | n/a | derived | false | None | Content Pack | Must exist in Dictionary and have rank table |
| FIELD-007 | guessWord | string | trimmed lowercase | in Dictionary | n/a | n/a | false | None | User input | Must match Dictionary tokenization rules; length bounds 1..64 |
| FIELD-008 | guessIndex | integer | int32 | `>=1` | guesses | 1 | false | None | Deterministic Functional Core | Must increment by 1 per accepted guess |
| FIELD-009 | guessTimestamp | integer | unix ms | `>=0` | ms | set on write | false | None | Platform Adapter (clock) | Must be monotonic non-decreasing within same dayId |
| FIELD-010 | semanticRank | integer | int32 | `1..vocabSize` (1=best) | rank | n/a | false | None | Per-Target Rank Table | Must exist for guessWord; must be deterministic |
| FIELD-011 | rankTier | integer | int32 | enum `0..N` (0=best) | tier | n/a | false | None | Per-Target Rank Table | Must map from semanticRank via tier thresholds |
| FIELD-012 | bestRank | integer | int32 | `1..vocabSize` | rank | vocabSize | false | None | Game State | Must equal min of all semanticRank in run |
| FIELD-013 | verdict | string | token | enum `warmer|colder|equal|best` | n/a | n/a | false | None | Deterministic Functional Core | Must be derived from comparing semanticRank vs bestRank-before |
| FIELD-014 | isWin | boolean | boolean | true/false | n/a | false | false | None | Deterministic Functional Core | True iff guessWord == targetWord |
| FIELD-015 | parGuesses | integer | int32 | `>=1` | guesses | derived | false | None | Content Pack | Must be present for puzzleId |
| FIELD-016 | puzzleStatus | string | token | enum `not_started|in_progress|won` | n/a | not_started | false | None | Game State | Must transition forward only |
| FIELD-017 | guessHistory | array | JSON array | list of guess records | n/a | [] | false | None | Game State | Each record must include FIELD-007,10,11,13,14,8 |
| FIELD-018 | currentStreak | integer | int32 | `>=0` | days | 0 | false | None | Stats | Must increment only on first win per dayId |
| FIELD-019 | maxStreak | integer | int32 | `>=0` | days | 0 | false | None | Stats | Must be >= currentStreak at all times |
| FIELD-020 | gamesPlayed | integer | int32 | `>=0` | games | 0 | false | None | Stats | Must increment once when puzzleStatus becomes in_progress |
| FIELD-021 | gamesWon | integer | int32 | `>=0` | wins | 0 | false | None | Stats | Must increment once per dayId upon win |
| FIELD-022 | guessesToWin | integer | int32 | `>=1` | guesses | n/a | true | None | Stats | Nullable until win; must equal final guessIndex on win |
| FIELD-023 | hintCount | integer | int32 | `>=0` | hints | 0 | false | None | Game State | Must increment per hint reveal |
| FIELD-024 | hintWord | string | lowercase | in Dictionary | n/a | n/a | true | None | Deterministic Functional Core | If non-null, must have semanticRank < bestRank-before |
| FIELD-025 | shareText | string | UTF-8 text | length 1..4000 | n/a | n/a | false | None | Deterministic Functional Core | Must not contain targetWord literal |
| FIELD-026 | platformId | string | token | enum `pwa|ios|android` | n/a | derived | false | None | Composition Root | Must be set at boot |
| FIELD-027 | storageKeyPrefix | string | token | `[A-Za-z0-9._:-]+` | n/a | `ladderless:` | false | None | Platform Adapter | Must be consistent across reads/writes |
| FIELD-028 | a11yAnnouncementsEnabled | boolean | boolean | true/false | n/a | true | false | None | Settings | Must default true |
| FIELD-029 | reducedMotionEnabled | boolean | boolean | true/false | n/a | system-pref | false | None | Settings | Must mirror OS/browser preference on first run |
| FIELD-030 | assetIntegrityHash | string | hex/base64 | `[A-Za-z0-9+/=]{16,}` | n/a | bundled | false | None | Content Pack | Must verify loaded assets match expected hash |

