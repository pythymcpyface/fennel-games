# IMPLEMENTATION-ROADMAP.md

## Phase Sequence

| Phase | Name | Primary REQ Coverage |
|---|---|---|
| Phase 0 | Repository & Toolchain Setup | NFR-001..NFR-006 (baseline) |
| Phase 1 | Content Build Tool — Corpus Ingestion | REQ-036, REQ-043 |
| Phase 2 | Content Build Tool — Candidate Enumeration | REQ-031 |
| Phase 3 | Content Build Tool — Panel Score Formula | REQ-036, REQ-037, REQ-038, REQ-039, REQ-040 |
| Phase 4 | Content Build Tool — Fairness Gate | REQ-032, REQ-033, REQ-034, REQ-035, REQ-042 |
| Phase 5 | Content Build Tool — Par Value Computation | REQ-041, REQ-042 |
| Phase 6 | Content Build Tool — Pack Serialization | REQ-044, REQ-046 |
| Phase 7 | Content Build Tool — Size Ceiling CI Guard | REQ-045 |
| Phase 8 | Engine — FNV-1a Category Hashing | REQ-001, REQ-004 |
| Phase 9 | Engine — Round State Initialization | REQ-002, REQ-003 |
| Phase 10 | Engine — Answer Validation & Normalization | REQ-005, REQ-006, REQ-007, REQ-008, REQ-009 |
| Phase 11 | Engine — Panel Score & Findability Lookup | REQ-010 |
| Phase 12 | Engine — Tick Counter Advancement | REQ-018, REQ-019, REQ-020, REQ-021 |
| Phase 13 | Engine — Verdict Computation | REQ-013, REQ-014, REQ-015, REQ-016, REQ-017 |
| Phase 14 | Content Pack Runtime Accessor — Load & Index | REQ-004 |
| Phase 15 | Content Pack Runtime Accessor — Daily Category Resolution | REQ-001, REQ-002, REQ-003 |
| Phase 16 | Content Pack Runtime Accessor — Practice Category Selection | REQ-024, REQ-025 |
| Phase 17 | Hub Shell — Storage Key Namespacing | REQ-022 |
| Phase 18 | Hub Shell — UTC Day Computation | REQ-002, REQ-003 |
| Phase 19 | Hub Shell — Schema Migration Contract | REQ-029 |
| Phase 20 | Hub Shell — Corrupt Save State Discard | REQ-028 |
| Phase 21 | Hub Shell — Independent Daily/Practice Migration | REQ-027, REQ-029 |
| Phase 22 | Hub Shell — Players.length>1 Repair | REQ-058 |
| Phase 23 | Hub Shell — Stats Record Update (Daily-only) | REQ-023 |
| Phase 24 | Hub Shell — Stats Record Reconciliation Retry | REQ-030 |
| Phase 25 | Hub Shell — contentPackVersion Pinning | REQ-001 |
| Phase 26 | Practice Isolation — Dev-Mode Invariant Assertion | REQ-022, REQ-023 |
| Phase 27 | Practice Isolation — Static Dependency-Graph Check | REQ-022, REQ-023 |
| Phase 28 | Practice Isolation — Single-Slot Overwrite | REQ-026 |
| Phase 29 | Carbon View — Accessible Input & Label | REQ-049 |
| Phase 30 | Carbon View — Tension Counter Rendering | REQ-051 |
| Phase 31 | Carbon View — Reduced Motion Handling | REQ-021 |
| Phase 32 | Carbon View — ARIA Live Region | REQ-050 |
| Phase 33 | Carbon View — Reveal Screen & Findability Badges | REQ-052, REQ-053 |
| Phase 34 | Share Module — shareText Generation | REQ-047 |
| Phase 35 | Share Module — Practice Labelling | REQ-048 |
| Phase 36 | Share Module — Pending-Verdict Guard | REQ-057 |
| Phase 37 | Hub Registry — Manifest Entry & Routes | REQ-054 |
| Phase 38 | Hub Registry — Precache Wiring | REQ-055 |
| Phase 39 | Accessibility Audit — axe-core CI Gate | REQ-049, REQ-050, REQ-051, REQ-052 |
| Phase 40 | Full Journey E2E Validation | REQ-001..REQ-058, REQ-056 |

> **Local correction (start-project Phase 2 post-check).** The orchestrator generated correct phase
> *names* but numbered its REQ references against a smaller, earlier requirement set: only 33 of the
> 58 hardened REQs were cited, 25 were absent entirely, and several rows pointed at unrelated
> requirements (Phase 17 "Storage Key Namespacing" cited REQ-012/013, which are terminal-submission
> and total-sum; Phase 29 "Accessible Input" cited REQ-022, the practice storage key; Phase 39
> "axe-core CI Gate" also cited REQ-022). Every phase row has been remapped by matching the phase
> name against the actual REQ titles in REQUIREMENTS.md. Coverage is now 58/58. The per-task REQ
> citations in the "Per-Phase Tasks" section below were generated under the same faulty numbering
> and should be read against this corrected table, not trusted individually.

## Per-Phase Tasks

**Phase 0 — Repository & Toolchain Setup**
- TASK-0.1: Initialize repository structure for Lowball plugin under hub monorepo conventions.
- TASK-0.2: Add `.gitignore` entries excluding GloVe 6B 50d file and SCOWL/wordkit corpus.
- TASK-0.3: Configure CI pipeline stub executing on push (no-op job).

**Phase 1 — Content Build Tool: Corpus Ingestion**
- TASK-1.1: Implement GloVe 6B 50d file loader from vendored filesystem path.
- TASK-1.2: Implement fail-fast error path for missing/unreadable GloVe file (ERROR-008).
- TASK-1.3: Implement SCOWL/wordkit corpus loader (111,676 en-GB words).
- TASK-1.4: Implement fail-fast error path for missing/malformed SCOWL corpus (ERROR-009).

**Phase 2 — Content Build Tool: Candidate Enumeration**
- TASK-2.1: Implement suffix candidate enumerator (length 2–4) over corpus.
- TASK-2.2: Implement prefix candidate enumerator (length 3–4) over corpus.
- TASK-2.3: Implement Answer List construction per candidate category (TERM-009).

**Phase 3 — Content Build Tool: Panel Score Formula**
- TASK-3.1: Implement `gloveRank` lookup per corpus word (FIELD-012).
- TASK-3.2: Implement `scowlTier` lookup per corpus word (FIELD-011).
- TASK-3.3: Implement panel score formula `100 * ((5.2 - log10(rank)) / 2.2)^2.2` with [0,100] clamping (REQ-009).
- TASK-3.4: Implement out-of-vocabulary and tier>50 zero-score rule (REQ-010).
- TASK-3.5: Implement NaN/Infinity anomaly handling as score 0 with build-report logging (ERROR-010).

**Phase 4 — Content Build Tool: Fairness Gate**
- TASK-4.1: Implement answer-count bounds check (10–36 inclusive).
- TASK-4.2: Implement top-score-≥45 check.
- TASK-4.3: Implement ≥6-findable-at-tier-≤50 check.
- TASK-4.4: Implement ≥1-findable-zero-scorer check.
- TASK-4.5: Implement ≥5-non-zero-answers-spanning-≥4-distinct-values check.
- TASK-4.6: Implement `parValue > 0` sixth gate criterion (REQ-042), closing RISK-001.

**Phase 5 — Content Build Tool: Par Value Computation**
- TASK-5.1: Implement median-of-findable-answers `parValue` computation (FIELD-013).
- TASK-5.2: Wire par computation to execute before the REQ-042 gate check per JOURNEY-003 step 5 ordering.

**Phase 6 — Content Build Tool: Pack Serialization**
- TASK-6.1: Implement Content Pack JSON serializer assigning `categoryId`/`categoryLabel` (FIELD-004/005).
- TASK-6.2: Implement exclusion assertion confirming zero GloVe raw data bytes in output (REQ-023).
- TASK-6.3: Implement `contentPackVersion` field writer (FIELD-002).

**Phase 7 — Content Build Tool: Size Ceiling CI Guard**
- TASK-7.1: Implement build-report emission with category admit/exclude counts.
- TASK-7.2: Implement CI step failing the build if serialized pack exceeds the REQ-045 ceiling.

**Phase 8 — Engine: FNV-1a Category Hashing**
- TASK-8.1: Implement `computeCategoryId(seed: DatasetSeed)` pure function using FNV-1a 32-bit (REQ-001).
- TASK-8.2: Implement hash-to-index mapping restricted to currently admitted category set (closes RISK-007).

**Phase 9 — Engine: Round State Initialization**
- TASK-9.1: Implement `initRound(category, answerList)` returning `tickCounter=100`, `sweepIndex=0` state.
- TASK-9.2: Implement same-day non-reassignment check (REQ-002).
- TASK-9.3: Implement stale-day (`dayId` mismatch) reset-to-fresh-round logic (REQ-003, EDGE-005).

**Phase 10 — Engine: Answer Validation & Normalization**
- TASK-10.1: Implement corpus-membership validation against supplied Answer List.
- TASK-10.2: Implement affix-fit validation against FIELD-006/007.
- TASK-10.3: Implement non-duplication check against earlier same-round answer (FIELD-024, ERROR-003).
- TASK-10.4: Implement whitespace/case/diacritic normalization rules (REQ-005).
- TASK-10.5: Implement empty-string defensive handling (EDGE-001).

**Phase 11 — Engine: Panel Score & Findability Lookup**
- TASK-11.1: Implement read-only `panelScore`/`isFindable` lookup from supplied Content Pack data (never recomputed at runtime, per ADR-002).
- TASK-11.2: Implement invalid-answer scoring rule (`panelScore = 100`) for ERROR-001/ERROR-002/ERROR-003 paths.

**Phase 12 — Engine: Tick Counter Advancement**
- TASK-12.1: Implement `advanceTick(state)` discrete decrement-by-one transition.
- TASK-12.2: Implement halt-at-target-score logic (tick equals `panelScore`).
- TASK-12.3: Implement reduced-motion jump-to-final-value transition (BRANCH-003).

**Phase 13 — Engine: Verdict Computation**
- TASK-13.1: Implement `totalScore` summation across both sweeps (FIELD-017).
- TASK-13.2: Implement `getVerdict(state)` strict-less-than comparison against `parValue` (TERM-020).
- TASK-13.3: Implement tie-at-parValue-equals-loss rule (EDGE explicitly resolved item 6 in Missing Edge Cases).

**Phase 14 — Content Pack Runtime Accessor: Load & Index**
- TASK-14.1: Implement precached Content Pack JSON loader at app boot.
- TASK-14.2: Implement pack schema-shape validation on load.
- TASK-14.3: Implement typed `PackUnavailable` result for empty-category-array case (REQ-019).

**Phase 15 — Content Pack Runtime Accessor: Daily Category Resolution**
- TASK-15.1: Implement `getDailyCategoryId(seed)` delegating to Engine's pure hash function.
- TASK-15.2: Implement `contentPackVersion` pinning into Save State at round start (REQ-020).

**Phase 16 — Content Pack Runtime Accessor: Practice Category Selection**
- TASK-16.1: Implement `selectPracticeCategory(excludeCategoryId)` deterministic algorithm per REQ-024/REQ-025.
- TASK-16.2: Implement single-category-pack fallback (BRANCH-004) with "Practice" UI label requirement.

**Phase 17 — Hub Shell: Storage Key Namespacing**
- TASK-17.1: Implement `storageKeyDaily` read/write functions, structurally separate namespace.
- TASK-17.2: Implement `storageKeyPractice` read/write functions, structurally separate namespace (REQ-012).

**Phase 18 — Hub Shell: UTC Day Computation**
- TASK-18.1: Implement `getUtcDayId()` deriving FIELD-001 from system clock at Hub Shell layer only (not Engine).

**Phase 19 — Hub Shell: Schema Migration Contract**
- TASK-19.1: Implement migration function signature per REQ-029, closing RISK-011.
- TASK-19.2: Implement migratable-schema-version upgrade path.

**Phase 20 — Hub Shell: Corrupt Save State Discard**
- TASK-20.1: Implement corrupt-JSON detection on load.
- TASK-20.2: Implement discard-and-fresh-round fallback (ERROR-004), never throwing.

**Phase 21 — Hub Shell: Independent Daily/Practice Migration**
- TASK-21.1: Implement migration execution scoped independently per storage key (REQ-017), confirming Daily migration cannot affect Practice state and vice versa.

**Phase 22 — Hub Shell: Players.length>1 Repair**
- TASK-22.1: Implement repair logic for Save State carrying more players than the mode allows (REQ-058).

**Phase 23 — Hub Shell: Stats Record Update (Daily-only)**
- TASK-23.1: Implement `updateStatsRecord(verdict)` invocation restricted to Daily code path only (REQ-021).

**Phase 24 — Hub Shell: Stats Record Reconciliation Retry**
- TASK-24.1: Implement detect-and-retry-once reconciliation on next Daily load if prior update failed (REQ-030), closing RISK-008.

**Phase 25 — Hub Shell: contentPackVersion Pinning**
- TASK-25.1: Implement pinning of `contentPackVersion` at round start to prevent mid-round pack upgrade drift (REQ-020, Missing Edge Case item 1).

**Phase 26 — Practice Isolation: Dev-Mode Invariant Assertion**
- TASK-26.1: Implement dev-mode runtime assertion firing on any attempted Practice→Daily/Stats cross-write (AC-012-04), closing RISK-004.

**Phase 27 — Practice Isolation: Static Dependency-Graph Check**
- TASK-27.1: Implement CI static-analysis check confirming no import path exists from Practice code module into `updateStatsRecord` (REQ-012).

**Phase 28 — Practice Isolation: Single-Slot Overwrite**
- TASK-28.1: Implement single-slot overwrite behavior for repeated Practice rounds under `storageKeyPractice` (REQ-026, ADR-006 resolved to Accepted).

**Phase 29 — Carbon View: Accessible Input & Label**
- TASK-29.1: Implement `<label>`/`aria-label` accessible text input per WCAG 2.1 AA (REQ-022).
- TASK-29.2: Implement accessible non-empty-submission validation message (EDGE-001 UI layer).

**Phase 30 — Carbon View: Tension Counter Rendering**
- TASK-30.1: Implement 100-discrete-bar column rendering driven by Engine tick state (TERM-014).
- TASK-30.2: Implement `requestAnimationFrame`-throttled schedule external to Engine calling `advanceTick`.

**Phase 31 — Carbon View: Reduced Motion Handling**
- TASK-31.1: Implement immediate-jump rendering when `prefers-reduced-motion` is active (BRANCH-003).
- TASK-31.2: Implement mid-drain reduced-motion toggle behavior per AC-006-04 (jump at current sweep boundary).

**Phase 32 — Carbon View: ARIA Live Region**
- TASK-32.1: Implement ARIA live region announcing submitted answer and resulting score per submission (non-visual channel).

**Phase 33 — Carbon View: Reveal Screen & Findability Badges**
- TASK-33.1: Implement reveal screen displaying both answers, `panelScore`, `isFindable` badges.
- TASK-33.2: Implement distinct visual treatment for findable-zero vs unfindable-zero answers (REQ-011).
- TASK-33.3: Implement textual/numeric readout accompanying Tension Counter final state (non-bar channel requirement).
- TASK-33.4: Implement tie-at-parValue announced explicitly as a loss (AC-022-05).

**Phase 34 — Share Module: shareText Generation**
- TASK-34.1: Implement `generateShareText(input: ShareInput)` pure function accepting only `totalScore`, `parValue`, `verdict`, `mode` (REQ-014).
- TASK-34.2: Implement structural typing preventing answer words from ever being passed as input (REQ-015).

**Phase 35 — Share Module: Practice Labelling**
- TASK-35.1: Implement "(Practice)" marker insertion into `shareText` for Practice-mode rounds (REQ-048).
- TASK-35.2: Implement no-label rendering for Daily-mode `shareText`.

**Phase 36 — Share Module: Pending-Verdict Guard**
- TASK-36.1: Implement blocking of Share invocation while `verdict = "pending"` (REQ-057).

**Phase 37 — Hub Registry: Manifest Entry & Routes**
- TASK-37.1: Implement `GameManifest` entry for Lowball (id, tile metadata) per C-007.
- TASK-37.2: Implement route registration for `/games/lowball` and `/games/lowball/practice` (ENTRY-001/002).

**Phase 38 — Hub Registry: Precache Wiring**
- TASK-38.1: Implement precache-manifest reference for Content Pack via service worker (ENTRY-005).
- TASK-38.2: Implement offline-safe error state for missing precached category data (ERROR-005).

**Phase 39 — Accessibility Audit: axe-core CI Gate**
- TASK-39.1: Implement automated axe-core CI check with zero-critical-violations threshold (REQ-022), addressing RISK-009.
- TASK-39.2: Implement manual screen-reader test script execution record.

**Phase 40 — Full Journey E2E Validation**
- TASK-40.1: Execute full_journey_e2e.feature happy-path scenario (REQ-001, REQ-004, REQ-005, REQ-011, REQ-014 combined).
- TASK-40.2: Execute reopen-same-day-then-next-day rollover scenario (REQ-002, REQ-003 combined).
- TASK-40.3: Confirm Coverage Matrix shows every REQ-001..REQ-058 mapped to at least one passing TEST-XXX identifier.

## Acceptance Per Phase

| Phase | Acceptance Criteria |
|---|---|
| 0 | CI pipeline runs on no-op commit; gitignore confirmed to exclude vendored assets. |
| 1 | ERROR-008/ERROR-009 fail-fast paths verified by unit test with missing-file fixtures. |
| 2 | Candidate enumeration produces non-empty suffix/prefix sets for the SCOWL corpus test fixture. |
| 3 | panel_score_formula.feature passes formula-correctness scenarios with defined tolerance; NaN/Infinity anomaly handling verified (ERROR-010). |
| 4 | content_build_fairness_gate.feature passes all six criteria individually and combined, including REQ-042. |
| 5 | Median-of-findable-answers computation matches reference fixture values; execution order (par before gate) verified. |
| 6 | Serialized pack contains zero bytes matching known GloVe file signatures; `contentPackVersion` present. |
| 7 | CI fails on a synthetic oversize-pack fixture; passes on an in-budget fixture. |
| 8 | AC-TEST-001 and AC-TEST-002 pass identically across iOS WKWebView, Android WebView, Desktop Chrome, Desktop Safari fixtures. |
| 9 | Same-day reopen resumes at saved `sweepIndex`; stale-day reopen resets to fresh round (EDGE-005). |
| 10 | answer_validation.feature passes valid/invalid/duplicate/normalization/empty-string scenarios with zero exceptions thrown. |
| 11 | `panelScore`/`isFindable` values match Content Pack fixture data with no runtime recomputation detected. |
| 12 | tension_counter.feature passes discrete-decrement, halt-at-target, and reduced-motion-skip scenarios. |
| 13 | scoring_and_verdict.feature passes win/loss boundary and tie-as-loss scenarios. |
| 14 | Empty-category-array fixture returns typed `PackUnavailable` result, not an exception. |
| 15 | `getDailyCategoryId` output matches Engine's `computeCategoryId` byte-for-byte on identical seed fixtures. |
| 16 | practice_mode_isolation.feature category-selection scenario confirms exclusion of today's Daily `categoryId`; single-category fallback labelled "Practice". |
| 17 | Storage-key read/write functions verified structurally namespaced via unit test asserting no shared code path. |
| 18 | `getUtcDayId()` output verified against fixed system-clock test fixtures across UTC boundary edge times. |
| 19 | Migration function signature test passes against REQ-029 contract fixture. |
| 20 | Corrupt-JSON fixture triggers discard-and-fresh-round path with zero thrown exceptions. |
| 21 | Daily migration execution leaves Practice storage-key state byte-for-byte unchanged, and vice versa. |
| 22 | players.length>1 fixture repaired to mode-allowed player count without data loss to slot 0. |
| 23 | `updateStatsRecord` call observed only on Daily verdict completion in integration test; never observed on Practice completion. |
| 24 | Simulated `updateStatsRecord` failure fixture triggers exactly one retry on next Daily load. |
| 25 | Mid-round pack-version-bump fixture confirms round continues under originally pinned version. |
| 26 | Dev-mode assertion fires (test-harness-observable) on synthetic cross-write attempt fixture. |
| 27 | Static dependency-graph CI check fails on a synthetic import-violation fixture and passes on the real codebase. |
| 28 | Second Practice round overwrites first under `storageKeyPractice`; no history array present in schema. |
| 29 | axe-core input-label check passes with zero critical violations on the input component in isolation. |
| 30 | Tension Counter bar count fixed at 100 in rendered fixture snapshot. |
| 31 | Reduced-motion fixture renders final tick value with zero intermediate frames recorded. |
| 32 | ARIA live region content matches submitted-answer-and-score fixture text on each submission event. |
| 33 | findability_reveal.feature passes findable/unfindable badge-distinction scenarios; AC-022-05 tie announcement verified. |
| 34 | Unit test confirms `ShareInput` type structurally excludes any answer-word field. |
| 35 | Practice `shareText` fixture contains "(Practice)"; Daily `shareText` fixture does not. |
| 36 | Share invocation attempt on `verdict="pending"` fixture is blocked/no-ops per REQ-057. |
| 37 | Manifest entry present in hub registry fixture; both routes render the Lowball view in a route-test harness. |
| 38 | Precache-before-first-play confirmed via service-worker fixture; missing-precache fixture renders offline-safe error state (ERROR-005). |
| 39 | axe-core full-page CI run reports zero critical violations across all Lowball views. |
| 40 | full_journey_e2e.feature passes both scenarios; Coverage Matrix report shows 100% of REQ-001..REQ-058 mapped to ≥1 passing TEST-XXX. |

## Risk Watch Per Phase

| Phase | Linked Risk IDs |
|---|---|
| 0 | RISK-006 (partial: gitignore mitigation) |
| 1 | RISK-006 |
| 2 | RISK-002 (open; candidate enumeration is the surface where corpus omissions originate) |
| 3 | RISK-002 |
| 4 | RISK-001 (resolved by REQ-042 within this phase) |
| 5 | RISK-001 |
| 6 | RISK-012 (resolved by REQ-045 in Phase 7, prepared here) |
| 7 | RISK-012 |
| 8 | RISK-007 (resolved by REQ-004 hash-to-index restriction) |
| 9 | RISK-003 (resolved: REQ-002/REQ-003 close the truncated-requirements gap for round lifecycle) |
| 10 | RISK-003, RISK-002 |
| 11 | RISK-002 |
| 12 | RISK-009 (partial: tick behavior underlies reduced-motion accessibility guarantee) |
| 13 | RISK-003 |
| 14 | RISK-003 |
| 15 | RISK-005 (open; pack-version resolution at this phase is limited to single-version case) |
| 16 | RISK-010 (resolved by REQ-024/REQ-025) |
| 17 | RISK-004 |
| 18 | RISK-005 |
| 19 | RISK-011 (resolved by REQ-029) |
| 20 | RISK-011 |
| 21 | RISK-004 |
| 22 | RISK-003 |
| 23 | RISK-008 (resolved by REQ-021/REQ-030) |
| 24 | RISK-008 |
| 25 | RISK-005 (mitigated for single-day scope; multi-version coexistence remains open) |
| 26 | RISK-004 (resolved: AC-012-04 dev-mode assertion) |
| 27 | RISK-004 |
| 28 | RISK-013 (accepted limitation; monitored, not eliminated) |
| 29 | RISK-009 |
| 30 | RISK-009 |
| 31 | RISK-009, RISK-013 |
| 32 | RISK-009 |
| 33 | RISK-009 |
| 34 | RISK-002 (share module must never surface an unvalidated answer word) |
| 35 | none (closed scope; no open RISK-XXX linked) |
| 36 | none (closed scope; no open RISK-XXX linked) |
| 37 | RISK-005 |
| 38 | RISK-006 |
| 39 | RISK-009 (final closure check) |
| 40 | RISK-001, RISK-002, RISK-003, RISK-004, RISK-005, RISK-006, RISK-007, RISK-008, RISK-009, RISK-010, RISK-011, RISK-012, RISK-013 (full register review at release gate) |