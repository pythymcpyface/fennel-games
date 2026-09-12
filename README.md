# Fennel Games

A hub of **offline-first daily word puzzles** — one app, a new puzzle per game every
day, in the spirit of the NYT Games bundle. Built from a single TypeScript/web codebase
and shipped as an installable **PWA + iOS + Android** app (Capacitor).

## The games

| Game | Mechanic |
|------|----------|
| 🌡️ **Ladderless** | Warmer/colder — hunt the hidden word by meaning. |
| 🔗 **Overlap** | Find the word that bridges two clue-words. |
| ✂️ **Sever** | Split a run-together string into the hidden phrase. |
| 🎭 **Odd Sense** | Four words share a theme; spot the impostor. |
| 🎵 **Rhyme Chain** | Build the longest chain of rhyming, clued words. |
| 🔍 **Hidden Middle** | Find the word hidden inside a longer word. |
| 🔀 **Tradeoff** | Swap one letter at a time to beat a score par. |
| 📈 **Degrees** | Order words from weakest to strongest on a hidden scale. |
| 👻 **Vowel Ghost** | Restore the missing vowels to a themed word set. |
| 🔢 **Numeronym** | Expand texting shorthand like GR8 and L8R. |
| ␣ **Kerning** | Re-space a letter run into a different hidden reading. |
| 🔤 **Acronym Attack** | Expand an acronym into a valid themed phrase. |
| 🌍 **Borrowed** | Match each loanword to the language it came from. |
| 🧾 **Loan Ledger** | Deduce a word's meaning from its morphemes. |
| 🗣️ **Stress Test** | Mark the stressed syllable in each word. |
| 🔁 **Palindial** | Morph a word into its reverse-reading twin. |
| ↔️ **Antonym Bridge** | Chain antonyms from one word to its far opposite. |
| 🧩 **Compound Split** | Recombine eight halves into four compound words. |
| 🔊 **Homophone Heist** | Decode a sentence written in sound-alikes. |
| 🧠 **Emoji Etymon** | Guess the word from an emoji rebus. |
| 🧵 **Affix Loom** | Weave prefixes and suffixes onto a base to build the word. |
| 🪜 **Word Morph** | Change one letter at a time to reach the target. |
| 🕸️ **Edit Clusters** | Spot the tightest one-letter-change family on the board. |
| 🎯 **Odd-One Gradient** | Tap the word that least belongs; wrong taps warm up. |
| 🌗 **Twin Trails** | Split the board into two hidden themes. |
| 📊 **Tier List** | Rank the words from most common to rarest. |
| 🕸 **Web Hub** | Tap the most-connected word in the one-letter-change web. |
| 🪜 **Edit-Ladder Trails** | Strands-style grid: trace an edit-ladder + a spangram across a perfect-cover board. |
| 🌡️ **Semantic Gradient** | Strands-style grid: trace words orbiting a hidden meaning; each reveals a hot/cold band. |
| ✨ **Semantic Constellation** | Strands-style grid: split the words into two hidden stars, bridged by a spangram. |
| 🪞 **Mirrorle** | Two hidden words; each guess shows only the summed greens/yellows across both. Deduce both. |
| 🌗 **Parallax** | Find the word whose meaning sits midway between two anchor words. |
| 🧶 **Seam** | Order the words into one chain where every neighbour pair forms a link. |
| 🌉 **Isthmus** | Trace one word-path connecting the top and bottom shores of the grid. |
| 🌫️ **Driftword** | Wordle, but the secret word drifts by one letter after each guess. |
| 🎯 **Isobar** | Place five words on meaning-rings by distance from a hidden centre. |
| 🚧 **Tollgate** | Word ladder where the cheapest total-toll path wins, not the shortest. |
| 👻 **Ghost Group** | Connections-style, but deduce and name the hidden fourth group. |
| 🍴 **Fork** | One start, two targets: build a shared trunk then branch to both. |
| 🎟️ **Ration** | Spend a shared, limited letter stock to hit word-length targets. |
| 🏦 **Overdraft** | Build one word; borrow up to two outside letters at a points cost. |
| 🧩 **Clueback** | The crossword's already solved — pick each answer's real clue from three. |
| 🔍 **Fault Lines** | The grid's filled in, but some answers are wrong — flag every fault. |
| 🌊 **Undertow** | A word search where every hidden word runs backwards — and forward words are traps. |
| 🌫️ **Fogline** | A fogged word search — each find lifts the fog to reveal the next words. |
| ⚖️ **Tare** | Split your weighted tiles into two words that balance the beam. |
| 📖 **Marginalia** | Choose each word to fill the blank — steer the branching story to its golden ending. |
| 🗝️ **Cipher Diary** | Decode today's enciphered diary entry from a few carried-over letters. |
| ⏳ **Decay** | Lock each decaying word before its letters fade away. |
| 🌧️ **Cascade Type** | Clear the word stack bottom-up; chain shared letters for a combo. |

Open the hub → pick a game → play today's puzzle. A shared board shows how many of the
day's puzzles you've solved. Each game keeps its own streak and progress, stored locally
and namespaced so they never collide. No accounts, no backend, fully playable offline.

## Architecture

A single app with a shared **kit** and pluggable **games**:

```
src/
  kit/            shared, reused by every game
    carbon.ts       real IBM Carbon Web Components helpers (cds-button/tag/notification)
    carbon-setup.ts registers @carbon/web-components + applies the g100 theme
    selection.ts    deterministic daily selection (FNV-1a + dayId hash)
    ports.ts        StoragePort / ClockPort / SharePort / AssetPort
    web-adapter.ts  browser adapter (localStorage + Web Share + fetch)
    cap-adapter.ts  Capacitor adapter (Preferences + native Share)
    composition-root.ts  platform detection + adapter selection
    stats.ts        shared per-game stats + streak
    persistence.ts  schema-versioned attempt save/load
    types.ts        GamePlugin / GameServices / DailyResult contracts
  hub/
    hub.ts          hash router + service injection + result dashboard
    hub-screen.ts   NYT-style selection grid
    registry.ts     the ordered list of games
  games/<id>/
    plugin.ts       implements GamePlugin (controller + view)
    engine.ts, hint.ts, share.ts, ...  the game's pure rules
    content-build.ts  build-time generator + fairness gate
public/<id>.json    each game's bundled, precached content pack
wordkit/            vendored @cic/wordkit — shared en-GB word data (build-time)
```

**Shared word data (`wordkit/`).** A vendored copy of the `@cic/wordkit` package
provides one British-English corpus for every game that needs real words:
`loadCorpus` (frequency-tiered en-GB validation lists), `buildRankTable` (GloVe
semantic ranks), `buildEditDistanceGraph`, and `wordTier` (frequency banding).
It is used **at build time only** by `tools/build-all-datasets.ts` — the vectors
never ship; games load their precomputed `public/<id>.json` pack at runtime.
Ladderless (semantic ranks), Sever (dictionary + frequency model), Affix Loom
(real-word lexicon), and Word Morph (dictionary + one-letter-change graph) are all
driven from it. Overlap, Odd Sense, Rhyme Chain, and Hidden Middle use curated
packs for data classes wordkit does not model (compounds, senses, rhymes).

The newest five games each lean on a single wordkit primitive, chosen for
determinism and fairness: **Edit Clusters** and **Web Hub** use the
one-letter-change graph (`buildEditDistanceGraph`) for densest-subset and
highest-degree-node puzzles; **Odd-One Gradient** and **Twin Trails** use GloVe
rank *margins* (`buildRankTable`) — the robust, large-gap signal — for outlier
detection and two-pivot classification; **Tier List** uses ground-truth SCOWL
frequency tiers (`wordTier`) to rank words common→rare. Every one ships a
build-time fairness gate that guarantees a unique, decisive answer.

**Edit-Ladder Trails** is the hub's first Strands-style game: a 6×6 letter grid
that is a *perfect cover* (every tile belongs to exactly one answer, traced as a
non-linear 8-direction path). The theme is an edit-distance-1 ladder of four
5-letter rungs (from `buildEditDistanceGraph`) plus an 8-letter spangram that
spans the grid top-to-bottom; two 4-letter fillers earn hints. Boards are packed
at build time by a deterministic, node-budgeted seeded backtracking solver and
validated by a fairness gate (perfect cover, contiguous paths, spanning spangram,
valid ladder) before shipping.


**GamePlugin contract:** the hub owns routing, the platform adapter, shared stats, and
the selection screen. Each game implements `mount(root, services)` and renders itself,
reporting a `DailyResult` for the shared board. Adding a game = drop a folder in
`src/games/`, a pack in `public/`, and one line in `registry.ts`.

Every game's warmer/colder / reveal / selection logic is a **pure deterministic core** —
identical verdicts across WKWebView, Android WebView, and browsers.

## Scripts

```bash
npm install
npm run dev        # hub + all games
npm test           # 585 unit/integration (Vitest)
npm run build      # typecheck + production PWA build (precaches all packs)
npm run e2e        # Playwright (chromium + WebKit + Pixel)
```

## Verification

960 unit/integration tests + 23 IBM Carbon integration e2e + hub/journey e2e (×3
runtimes: chromium, WebKit/iOS, Pixel/Android) passing; typecheck clean; offline PWA
build precaching the shell and every content pack (59 precache entries). Native
platforms scaffolded via `cap add ios` and `cap add android` (both sync all 50 content
packs into the native binaries; iOS `pod install` requires full Xcode).

## Novel games (this session)

20 genuinely novel daily word games (2 per genre across 10 genres) were designed from
bob-researcher taxonomy/format research, prior-art-vetted, spec'd via `/spec-workflow`,
and built end-to-end into this hub with real IBM Carbon Web Components. Each has a pure
deterministic engine, a build-time fairness gate, a spoiler-safe share, WCAG 2.1 AA UI,
and UTC daily selection. See `docs/research/BUILD-TRACKER.md` for the full roster.

## Specs

Per-game spec packs (glossary, journeys, requirements, architecture, risks, Test Plan)
under `docs/specs/<game>/`.

## License

MIT.
