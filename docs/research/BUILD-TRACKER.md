# Novel Games â Build Tracker (this session)

Ranked execution of the 20 vetted novel games. Each game runs the full cycle:
spec-workflow â start-project â feature-dev â review â bug-fix â docs â commit.

Status: PENDING / SPEC / BUILT / REVIEWED / COMMITTED

**ALL 20 NOVEL GAMES COMMITTED.** 960 unit tests + 23 Carbon e2e passing; PWA build green (59 precache entries). Every game: spec-workflow spec (persisted under .bob/notes/), pure deterministic engine, build-time fairness gate, real IBM Carbon Web Components UI, WCAG 2.1 AA, spoiler-safe share, UTC daily, hub GamePlugin integration, individually committed + secret-scanned.

## Wave 1 â highest-value NOVEL (deduction + semantic + connection + tile)
| # | Game | Genre | Verdict | Status | Spec | Notes |
|---|------|-------|---------|--------|------|-------|
| 1 | Mirrorle | Deduction | NOVEL | COMMITTED | notes/mirrorle | aggregated two-target feedback; 22 tests; in hub+PWA |
| 2 | Parallax | Semantic | NOVEL | COMMITTED | notes/parallax | embedding midpoint; 20 tests; packed 128KB pack |
| 3 | Seam | Connection | NOVEL | COMMITTED | notes/seam | ordered hidden-link chain; 18 tests; unique-up-to-reversal gate |
| 4 | Isthmus | Tile | NOVEL | COMMITTED | notes/isthmus | shore-to-shore word path; 17 tests; DFS+known-path gate |
| 5 | Driftword | Deduction | NOVEL | COMMITTED | notes/driftword | deterministic drifting target; 18 tests; ladder gate |
| 6 | Isobar | Semantic | NOVEL | COMMITTED | notes/isobar | concentric meaning rings; 18 tests; distinct-ring gate |
| 7 | Tollgate | Ladder | NOVEL | COMMITTED | notes/tollgate | weighted min-cost ladder; 17 tests; Dijkstra par gate |

## Wave 2 â RECOMBINATION with strong differentiators
| # | Game | Genre | Verdict | Status | Spec | Notes |
|---|------|-------|---------|--------|------|-------|
| 8 | Ghost Group | Connection | RECOMB | COMMITTED | notes/ghost-group | name the hidden 4th group; 15 tests; disjoint-cover gate |
| 9 | Fork | Ladder | RECOMB | COMMITTED | notes/fork | branching two-target ladder; 16 tests; BFS Steiner par gate |
| 10 | Ration | Anagram | NOVEL-l | COMMITTED | notes/ration | shared letter-inventory budget; 18 tests; achievability gate |
| 11 | Overdraft | Anagram | NOVEL-l | COMMITTED | notes/overdraft | borrow letters at a cost; 18 tests; Carbon from start; positive-in-set gate |
| 12 | Clueback | Crossword | NOVEL-l | COMMITTED | notes/clueback | reverse crossword: pick the real clue from 3; 20 tests; lock-after-select; distinct-clue + no-answer-leak gate; Carbon-first |
| 13 | Fault Lines | Crossword | RECOMB | COMMITTED | notes/fault-lines | audit a filled grid: flag faulty entries; score = correct−false; 18 tests; geometry+crossing+dict+count gate; Carbon-first |

## Wave 3 â search / narrative / typing / balance
| # | Game | Genre | Verdict | Status | Spec | Notes |
|---|------|-------|---------|--------|------|-------|
| 14 | Undertow | Word search | RECOMB | COMMITTED | notes/undertow | reversed-only targets + forward decoys (false currents); 22 tests; reverse-read/forward-read/line-collision/geometry gate; Carbon-first |
| 15 | Fogline | Word search | RECOMB | COMMITTED | notes/fogline | progressive de-fog: seed reveal, finds recede fog by radius; can't select into fog; 19 tests; forward-read/dims/span/solvable-from-seed gate; Carbon-first |
| 16 | Tare | Tile | RECOMB | COMMITTED | notes/tare | weight-balance placement: split rack into two words that balance the beam; 20 tests; dict+rack-multiset+balance gate; wordkit pairs; Carbon-first |
| 17 | Marginalia | Narrative | RECOMB | COMMITTED | notes/marginalia | branching cloze story DAG: each word choice steers to a next node; reach golden ending; 19 tests; DAG/reachability/3-choice/golden-terminal/single-path gate; Carbon-first |
| 18 | Cipher Diary | Narrative | RECOMB | COMMITTED | notes/cipher-diary | monoalphabetic substitution decode of a diary entry, key fragment carried over; 21 tests; bijection/encryption/fragment-bounds gate; Carbon-first |
| 19 | Decay | Typing | RECOMB | COMMITTED | notes/decay | turn-based degrading words: each guess hides a letter; lock before fully faded; 20 tests; dict/distinct/permutation/tick0 gate; wordkit; Carbon-first |
| 20 | Cascade Type | Typing | RECOMB | COMMITTED | notes/cascade-type | clear stacked rows bottom-up; adjacency-combo for shared-letter chains; 19 tests; rows/dict/distinct gate; wordkit; Carbon-first |

## Wave 4 — inverted scoring
| # | Game | Genre | Verdict | Status | Spec | Notes |
|---|------|-------|---------|--------|------|-------|
| 21 | Lowball | Deduction | NOVEL | COMMITTED | specs/lowball | Pointless-style inversion: lowest panel score wins, two sweeps summed vs par; panel score is a MODEL derived from GloVe vocab rank + SCOWL tier at build time, disclosed in-UI as "simulated panel of 100" (not a real survey); 110 tests; six-rule gate (10-36 answers, trap >=45, >=6 findable, >=1 findable zero-scorer, graded ladder, par>0) — deliberately NOT a uniqueness gate; 988/4679 categories admitted, 120 shipped at 163KiB; findable-vs-obscure reveal badges; Carbon-first |

## Cross-cutting (after game builds)
- [x] Real @carbon/web-components migration: @carbon/web-components + @carbon/styles installed; cds-button/tag/notification helpers in kit/carbon.ts; g100 theme; all 10 novel games route action buttons through real Carbon; 13 Carbon e2e tests pass
- [ ] cap add ios/android + cap sync + PWA precache
- [ ] Hub-wide user journeys spec + Playwright e2e Ã3 runtimes
- [ ] Final README + docs update

## Method note
Games built in ranked order, fully (specâbuildâtestâcommit) per game, so any
interrupted run leaves only working, committed games behind. Orchestrator spec
calls are ~4-5 min each; specs persist under `.bob/notes/<slug>/sdlc-plan.md`.
