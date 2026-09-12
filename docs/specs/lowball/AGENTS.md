# .bob/AGENTS.md

## Agent Roles

### Engine Agent (C-001 owner)

**Purpose:** Implement the pure, deterministic Lowball Engine: round-state transitions, FNV-1a category hashing, answer validation delegation points, tick advancement, and verdict computation.

**Scope:** `computeCategoryId`, `initRound`, `submitAnswer`, `advanceTick`, `getVerdict`; the `players[]`/`activePlayerIndex`/`sweepIndex` state shape; REQ-001 through REQ-006, REQ-011, REQ-016; Phases 8–13.

**Inputs:** Dataset Seed (dayId, contentPackVersion, datasetId); Category + Answer List supplied by the Content Pack Runtime Accessor Agent; `reducedMotion: boolean` as a plain read-only parameter; prior `RoundState`.

**Outputs:** New `RoundState` objects (pure, no I/O); computed `categoryId`, `panelScore`, `isFindable`, `totalScore`, `verdict`; test-observable byte-identical hash outputs across platforms.

**Hand-offs:** Receives Category + Answer List from the Content Pack Runtime Accessor Agent (Phase 14–16); hands `RoundState` transitions to the Carbon View Agent (Phase 29–33) and hashed `categoryId` to the Hub Shell Agent for `contentPackVersion` pinning (Phase 25).

**Success criteria:** Gate G3 exit — `daily_category_selection.feature`, `answer_validation.feature`, `scoring_and_verdict.feature` pass with zero exceptions thrown for any player-input path; identical `categoryId` across iOS WKWebView, Android WebView, Desktop Chrome, Desktop Safari (AC-TEST-002).

---

### Content Build Tool Agent (C-006 owner)

**Purpose:** Offline, dev-only generation of the versioned Content Pack from vendored GloVe/SCOWL corpora, including candidate enumeration, panel-score computation, Fairness Gate admission, and pack serialization.

**Scope:** GloVe/SCOWL loaders, candidate affix enumeration, panel score formula, six-criterion Fairness Gate (including REQ-042), `parValue` computation, pack serializer, size-ceiling CI guard; REQ-007 through REQ-010, REQ-023, REQ-042, REQ-045; Phases 1–7.

**Inputs:** Vendored GloVe 6B 50d file (filesystem, gitignored); vendored SCOWL/wordkit corpus (111,676 en-GB words); build CLI invocation (ENTRY-003).

**Outputs:** `content-pack.lowball.vX.Y.Z.json` (~150 KB target, ≤ REQ-045 ceiling); build report with admit/exclude counts and anomaly log (ERROR-010).

**Hand-offs:** Emits the serialized Content Pack artifact consumed by the Content Pack Runtime Accessor Agent at precache time (ENTRY-005); crosses the Zone A → Zone B trust boundary as the sole artifact.

**Success criteria:** Gate G1 exit — `panel_score_formula.feature` and `content_build_fairness_gate.feature` pass all six criteria individually and combined, ≥120 admitted categories out of ≤1045 candidates; Gate G2 exit — `content_pack_build_and_size.feature` passes, zero GloVe bytes present in output artifact.

---

### Content Pack Runtime Accessor Agent (C-002 owner)

**Purpose:** Load, index, and expose the precached Content Pack at runtime; resolve Daily category via the Engine's pure hash function; select a deterministic Practice category excluding today's Daily category.

**Scope:** `getCategory`, `getDailyCategoryId`, `selectPracticeCategory`, `getPackVersion`; pack schema-shape validation on load; typed `PackUnavailable` result; REQ-019, REQ-020, REQ-024, REQ-025; Phases 14–16.

**Inputs:** Precached Content Pack JSON (via service worker / bundled assets); `categoryId` to exclude for Practice selection; Dataset Seed for Daily resolution.

**Outputs:** `Category | null`; `CategoryId`; typed `PackUnavailable` error object; `contentPackVersion` string.

**Hand-offs:** Receives the pack artifact from the Content Build Tool Agent via precache wiring (Phase 38); supplies Category + Answer List to the Engine Agent; supplies `contentPackVersion` to the Hub Shell Agent for pinning into Save State (Phase 25).

**Success criteria:** Gate G4 exit (shared) — empty-category-array fixture returns typed `PackUnavailable`, never an exception; `getDailyCategoryId` output matches Engine's `computeCategoryId` byte-for-byte on identical seed fixtures (Phase 15 acceptance).

---

### Hub Shell Integration Agent (C-003 owner)

**Purpose:** Own storage namespacing, UTC day computation, Save State schema migration, and Stats Record write authority (Daily-only).

**Scope:** `loadDailySave`, `loadPracticeSave`, `persistDailySave`, `persistPracticeSave`, `updateStatsRecord`, `getUtcDayId`, `getReducedMotion`; REQ-012, REQ-013, REQ-017 through REQ-021, REQ-029, REQ-030, REQ-058; Phases 17–28.

**Inputs:** Raw storage bytes under `storageKeyDaily` / `storageKeyPractice`; system clock; hub-global `prefers-reduced-motion` signal; `verdict` from the Engine Agent; `contentPackVersion` from the Content Pack Runtime Accessor Agent.

**Outputs:** Loaded/repaired `SaveState` objects; migrated schema versions; Stats Record updates (Daily-only); dev-mode assertion firings on invariant violation.

**Hand-offs:** Supplies loaded `SaveState` and `dayId` to the Engine Agent (via Content Pack Runtime Accessor for category resolution); receives completed `RoundState`/`verdict` from the Carbon View Agent for persistence; never receives or forwards Practice-mode data into any Stats Record call path.

**Success criteria:** Gate G4 exit — `persistence_and_schema_migration.feature` passes for all six schema scenarios listed (no-op, migration, corrupt-discard, independent Daily/Practice migration, players.length>1 repair, empty-category-array); Gate G5 exit — static dependency-graph check confirms zero import paths from Practice code into `updateStatsRecord`; dev-mode assertion (AC-012-04) fires on synthetic cross-write.

---

### Carbon View Agent (C-005 owner)

**Purpose:** Render the accessible UI: category prompt, text input, 100-bar Tension Counter, ARIA live region, reveal screen with findability badges, and Share invocation trigger.

**Scope:** DOM/Carbon Web Component rendering, `requestAnimationFrame`-throttled `advanceTick` scheduling, reduced-motion jump handling, WCAG 2.1 AA markup; REQ-021, REQ-049, REQ-050, REQ-051, REQ-052, REQ-053; Phases 29–33, 39.

**Inputs:** `RoundState` transitions from the Engine Agent; `reducedMotion` boolean from the Hub Shell Agent; Category/Answer List labels from the Content Pack Runtime Accessor Agent; `shareText` from the Share Module Agent.

**Outputs:** Rendered DOM, ARIA live announcements, reveal screen with `panelScore`/`isFindable` badges and tie-as-loss (AC-022-05) announcement; user-initiated Share button events.

**Hand-offs:** Calls `advanceTick` on the Engine Agent per animation frame (or jumps if reduced motion); calls `persistDailySave`/`persistPracticeSave` on the Hub Shell Agent at round completion; invokes `generateShareText` on the Share Module Agent when Player taps Share.

**Success criteria:** Gate G6 exit — `accessibility.feature` passes with zero axe-core critical violations; ARIA live region announces score per submission; non-bar textual score channel present; reduced-motion mid-drain toggle behavior matches AC-006-04.

---

### Share Module Agent (C-004 owner)

**Purpose:** Generate spoiler-safe share text from scores only, structurally excluding answer words, with Practice-mode labelling and pending-verdict guard.

**Scope:** `generateShareText(input: ShareInput)`; REQ-014, REQ-015, REQ-016, REQ-048, REQ-057; Phases 34–36.

**Inputs:** `{ totalScore, parValue, verdict, mode: "daily"|"practice" }` — structurally typed to exclude any answer-word field.

**Outputs:** `shareText` string, with "(Practice)" marker for Practice-mode rounds and no marker for Daily-mode rounds; blocked/no-op result when `verdict = "pending"`.

**Hand-offs:** Invoked by the Carbon View Agent on Share button tap; returns plain string to the Carbon View Agent for platform share-sheet/clipboard invocation (which the Share Module Agent does not itself perform).

**Success criteria:** Gate G7 exit — unit test confirms `generateShareText` output contains no substring equal to either submitted answer word across a corpus of generated test cases; Practice `shareText` contains "(Practice)"; Daily `shareText` does not; Share invocation blocked while `verdict = "pending"`.

---

### Hub Registry Agent (C-007 owner)

**Purpose:** Register Lowball as a hub plugin: manifest entry, route wiring, and precache manifest reference.

**Scope:** `GameManifest` entry (id, tile metadata); route registration for `/games/lowball` and `/games/lowball/practice`; precache-manifest reference for the Content Pack; REQ-025, REQ-058, ENTRY-001, ENTRY-002, ENTRY-005; Phases 37–38.

**Inputs:** Content Pack artifact location/version from the Content Build Tool Agent; hub's pre-existing `GameManifest` contract.

**Outputs:** Registered manifest entry; functioning routes rendering the Lowball view; precache wiring for offline-safe boot.

**Hand-offs:** Provides route entry points consumed by the Carbon View Agent at ENTRY-001/ENTRY-002; provides precache wiring consumed by the Content Pack Runtime Accessor Agent at app boot (ENTRY-004).

**Success criteria:** Gate G8 exit (shared) — `hub_registration_and_routing.feature` confirms manifest entry and precache-before-first-play; missing-precache fixture renders offline-safe error state (ERROR-005).

---

### QA / Test Agent

**Purpose:** Own execution of the full Gherkin feature suite, the Coverage Matrix, and the axe-core CI accessibility gate across all phases; approve/reject Quality Gate transitions.

**Scope:** All 16 feature files (`daily_category_selection.feature` through `full_journey_e2e.feature`); Coverage Matrix confirming REQ-001..REQ-058 mapped to ≥1 passing TEST-XXX; Gates G0 through G8; Phases 0–40 (cross-cutting).

**Inputs:** Code-complete deliverables from every other agent at each phase boundary; feature files and step definitions from TDD-STRATEGY.md; Test Fixtures table (23 named fixtures).

**Outputs:** Gate pass/fail determinations; Coverage Matrix report; axe-core CI run results; RISK register status updates (e.g., RISK-004, RISK-009, RISK-013 monitoring).

**Hand-offs:** Receives code-complete modules from each owning agent at the corresponding Gate's entry condition; reports Gate outcome back to all agents and to the Risk aggregation process; final Gate G8 sign-off gates release.

**Success criteria:** Gate G8 exit — `full_journey_e2e.feature` passes both same-day-reopen and next-day-rollover scenarios; Coverage Matrix shows 100% of REQ-001..REQ-058 mapped to ≥1 passing TEST-XXX; RISK register review confirms no CRITICAL-severity item in Open status.

## Agent Boundaries

- **Engine Agent** does NOT perform storage I/O, does NOT call `Date.now()` or access wall-clock time, does NOT render DOM/ARIA markup, does NOT read `prefers-reduced-motion` (receives it only as a plain parameter), does NOT load or parse the Content Pack, does NOT mutate the Stats Record.
- **Content Build Tool Agent** does NOT run at runtime, does NOT ship in the client bundle, does NOT recompute panel scores after admission, does NOT perform any gameplay logic.
- **Content Pack Runtime Accessor Agent** does NOT generate Content Pack data (Build Tool Agent's job), does NOT perform network fetches during gameplay (only at boot via precache), does NOT compute scores or verdicts.
- **Hub Shell Integration Agent** does NOT own round rules, scoring, or hashing math (delegates to Engine Agent / Content Pack Runtime Accessor Agent), does NOT ever write Practice results to `storageKeyDaily` or invoke `updateStatsRecord` from a Practice code path.
- **Carbon View Agent** does NOT compute scores, validate answers, persist state, or perform hashing; does NOT decide the drain target value (only schedules *when* to call `advanceTick`, never *what* it computes).
- **Share Module Agent** does NOT receive or process answer words in any form, does NOT invoke the platform share sheet or clipboard API itself (delegates to the calling View), does NOT perform I/O.
- **Hub Registry Agent** does NOT implement any runtime gameplay logic; registration metadata only.
- **QA / Test Agent** does NOT author production code or fix defects directly; approves/rejects Gate transitions and reports risk status only, deferring implementation fixes to the owning agent.

## Hand-off Sequence

1. **Content Build Tool Agent** completes Phases 0–7 (Repository Setup → Size Ceiling CI Guard), emitting the Content Pack artifact and passing Gates G0–G2. *(Cross-references RISK-001, RISK-006, RISK-012.)*
2. **Engine Agent** completes Phases 8–13 (FNV-1a Hashing → Verdict Computation) in parallel-eligible sequence after Phase 7, passing Gate G3. *(Cross-references RISK-003, RISK-007.)*
3. **Content Pack Runtime Accessor Agent** completes Phases 14–16 (Load & Index → Practice Category Selection), consuming the Phase 7 artifact and the Phase 8 hash function from the Engine Agent. *(Cross-references RISK-005, RISK-010.)*
4. **Hub Shell Integration Agent** completes Phases 17–28 (Storage Key Namespacing → Single-Slot Overwrite), consuming `getDailyCategoryId`/`selectPracticeCategory` from Step 3, passing Gates G4 and G5. *(Cross-references RISK-004, RISK-008, RISK-011.)*
5. **Carbon View Agent** completes Phases 29–33 and 39 (Accessible Input → Reveal Screen; axe-core CI Gate), consuming `RoundState` transitions from the Engine Agent and `reducedMotion`/persistence hooks from the Hub Shell Integration Agent, passing Gate G6. *(Cross-references RISK-009.)*
6. **Share Module Agent** completes Phases 34–36 (shareText Generation → Pending-Verdict Guard), consuming `verdict`/`totalScore`/`parValue`/`mode` surfaced by the Carbon View Agent's reveal step, passing Gate G7.
7. **Hub Registry Agent** completes Phases 37–38 (Manifest Entry & Routes → Precache Wiring), wiring the Carbon View Agent's routes and the Content Pack Runtime Accessor Agent's precache dependency.
8. **QA / Test Agent** executes Phase 40 (Full Journey E2E Validation) against the fully integrated system from Steps 1–7, confirms the Coverage Matrix, and performs the full RISK register review, passing Gate G8 for release readiness. *(Cross-references RISK-001 through RISK-013, full register review.)*

---

## Local corrections applied after generation (start-project Phase 2 post-check)

The orchestrator numbered its REQ citations against an earlier, smaller requirement set. Two
corrections were applied to this file and its siblings:

1. **Carbon View Agent scope** cited REQ-011 (sweep-index advance, an engine concern) and REQ-022
   (practice storage key, a Hub Shell concern). Corrected to the actual view requirements:
   REQ-021 (reduced motion), REQ-049 (accessible name), REQ-050 (live region), REQ-051 (text
   channel), REQ-052 (findability badges), REQ-053 (simulated-panel disclosure).

2. **Honesty constraint (REQ-053)** was absent from the whole generated planning pack. Restating it
   here because it constrains every agent that renders a score: panel scores are a **derived
   statistical model**, not a survey of real people. The UI must render the literal string
   `simulated panel of 100 · from corpus frequency` wherever a score appears, and must never imply
   real people were asked. See RISKS-AND-MITIGATIONS.md § "Honesty constraint".

Other REQ ids cited elsewhere in this file were generated under the same faulty numbering. Treat
IMPLEMENTATION-ROADMAP.md's corrected phase table as the authoritative phase-to-REQ mapping.
