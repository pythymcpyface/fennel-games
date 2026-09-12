# PROJECT-PLAN.md

## Overview

**Project Name:** Lowball (CIC Games Hub title)

**Scope:** Deliver a single-player, offline-capable word-scoring game consisting of: (1) a pure deterministic Lowball Engine (C-001) implementing round state transitions, hashing, scoring, and verdict logic per REQ-001 through REQ-058; (2) a Content Pack Runtime Accessor (C-002); (3) a Hub Shell Integration Layer (C-003) for Save State persistence and Stats Record updates; (4) a Spoiler-Safe Share Module (C-004); (5) a Lowball Carbon View (C-005) satisfying WCAG 2.1 AA; (6) an offline, dev-only Content Build Tool (C-006) that generates the versioned Content Pack from vendored GloVe/SCOWL corpora; and (7) a Hub Registry Entry (C-007). Scope covers Daily Round (TERM-001) and Practice Round (TERM-002) journeys (JOURNEY-001, JOURNEY-002), the score reveal and Spoiler-Safe Share flow (JOURNEY-004), and the build-time Fairness Gate pipeline (JOURNEY-003).

**Goals:**
- Implement all 58 requirements (REQ-001 through REQ-058) and both Non-Functional Requirement rows referenced in NFR-001 through NFR-006, traced to TEST-001 through TEST-098.
- Ship a Content Pack (TERM-012) of at least 120 admitted Affix Categories (TERM-003) passing the six-criterion Fairness Gate (TERM-013), including the `parValue > 0` gate criterion codified by REQ-042.
- Guarantee Practice Round isolation from Daily Save State and Stats Record (TERM-011) per REQ-012/REQ-013, closing RISK-004.
- Deliver WCAG 2.1 AA conformant UI including non-bar score channels and ARIA live announcements per REQ-022.
- Ensure deterministic, offline-only runtime behavior with no network calls during gameplay, per the Zone A/Zone B trust-boundary split in ARCHITECTURE.md.

**Non-Goals:**
- No user accounts, authentication, or PII collection (confirmed N/A per Security Architecture).
- No backend/API (Zone C does not exist for Lowball v1).
- No multiplayer gameplay in v1 (Player Slot array supports ≤4 slots per TERM-016, but only slot 0 is active per REQ-058; multi-slot activation is out of scope).
- No Practice Round history beyond the single latest round (ADR-006 / REQ-026: single-slot v1).
- No runtime recomputation of GloVe/SCOWL panel-score formulas (build-time only, per ADR-002).
- No resolution of RISK-005 (multi pack-version coexistence ADR) or RISK-002 (secondary wordlist cross-validation) within this plan; both remain open and tracked outside delivery scope.

## Stakeholders

| Role | Responsibilities | Decision Rights |
|---|---|---|
| Requirements Author | Owns REQ-001..REQ-058 traceability; resolves ambiguity flagged by RISK-003, RISK-010 | Final sign-off on requirement wording and acceptance criteria (AC-XXX) |
| Architect | Owns ARCHITECTURE.md component boundaries (C-001..C-007), ADR-001..ADR-008 | Approves component boundary changes; owns RISK-005 (pack-version-transition ADR, still open) |
| Engine Owner (C-001) | Implements pure round-state transitions, FNV-1a hashing, tick advancement, verdict computation | Approves Engine API surface (`computeCategoryId`, `submitAnswer`, `advanceTick`, `getVerdict`) |
| Hub Shell / C-003 Owner | Implements storage namespacing, UTC day computation, Stats Record write authority, schema migration (REQ-029) | Approves migration function contract; owns RISK-004 dev-mode assertion (AC-012-04) |
| View Owner (C-005) | Implements Carbon Web Component UI, Tension Counter rendering, accessibility markup | Approves UI acceptance criteria against WCAG 2.1 AA; co-owns RISK-009 with QA |
| Build Tool Owner (C-006) | Implements Fairness Gate, panel score formula, pack serialization/size ceiling (REQ-045) | Approves Content Pack admission criteria; owns RISK-001 (resolved via REQ-042), RISK-006, RISK-012 (resolved via REQ-045) |
| QA / Test Lead | Owns TDD-STRATEGY.md feature-file execution, Coverage Matrix, axe-core CI gate | Approves Quality Gate pass/fail per phase; owns RISK-009 (partial), RISK-013 |
| Hub Shell (system stakeholder) | Provides registry, storage, reduced-motion signal, Stats/streak module (pre-existing) | No decision rights over Lowball-specific logic; contract consumer only |
| Player (end user, non-decision-making) | Source of acceptance feedback via journey walkthroughs | None (no accounts, no PII, local-only) |

## Milestones

**M0 — Repository & Toolchain Setup**
Scope-scaled per "small" class. Establishes C-006 CLI scaffold, vendored-asset gitignore rules (RISK-006 mitigation partial), and CI skeleton.

**M1 — Content Build Tool: Corpus Ingestion & Candidate Enumeration**
Delivers GloVe/SCOWL loading (ERROR-008/009 fail-fast), affix candidate enumeration (JOURNEY-003 steps 1–2).

**M2 — Content Build Tool: Panel Score Formula & Fairness Gate**
Delivers panel score formula (REQ-009/REQ-010), Fairness Gate six criteria including REQ-042 (`parValue > 0`), closing RISK-001.

**M3 — Content Pack Serialization & Size Ceiling**
Delivers pack serialization (~150 KB target), REQ-045 CI size-ceiling check, closing RISK-012.

**M4 — Lowball Engine: Core State Machine**
Delivers REQ-001 (FNV-1a category selection), REQ-004/REQ-005 (answer validation, normalization), REQ-006 (tick advancement), verdict computation.

**M5 — Hub Shell Integration: Save State & Stats Record**
Delivers REQ-017 through REQ-021 (schema migration, contentPackVersion pinning, Stats Record reconciliation), REQ-029 (migration contract), closing RISK-011.

**M6 — Practice Mode Isolation**
Delivers REQ-012/REQ-013 (storage namespacing, no Stats Record write), REQ-024/REQ-025 (deterministic Practice category selection), AC-012-04 dev-mode assertion, closing RISK-004 and RISK-010.

**M7 — Carbon View, Accessibility & Reveal**
Delivers REQ-022 (accessibility), REQ-011 (findability reveal badges), Tension Counter drain/reduced-motion behavior (AC-006-04), closing RISK-009 (partial).

**M8 — Spoiler-Safe Share Module**
Delivers REQ-014/REQ-015/REQ-016 (share text generation, Practice labelling per REQ-048, pending-verdict share guard per REQ-057).

**M9 — Hub Registration & End-to-End Journey Validation**
Delivers REQ-025 (hub manifest, C-007 registry entry), full_journey_e2e.feature execution, sign-off against all Quality Gates.

## Deliverables

| Milestone | Deliverable | Traceable REQ IDs |
|---|---|---|
| M0 | CI skeleton, vendored-asset gitignore config, repository scaffold | NFR-001..NFR-006 (baseline tooling) |
| M1 | GloVe/SCOWL loader with fail-fast error handling; candidate affix enumerator | ERROR-008, ERROR-009, REQ-007, REQ-008 |
| M2 | Panel score formula module; six-criterion Fairness Gate implementation | REQ-009, REQ-010, REQ-042 |
| M3 | Content Pack serializer; CI size-ceiling check (≤200 KB per TEST plan, ~150 KB target) | REQ-023, REQ-045 |
| M4 | Lowball Engine module: `computeCategoryId`, `submitAnswer`, `advanceTick`, `getVerdict` | REQ-001, REQ-004, REQ-005, REQ-006 |
| M5 | Hub Shell Integration Layer: Save State load/persist, schema migration, Stats Record reconciliation | REQ-017, REQ-018, REQ-019, REQ-020, REQ-021, REQ-029, REQ-030 |
| M6 | Practice Mode isolation implementation with dev-mode invariant assertion | REQ-012, REQ-013, REQ-024, REQ-025, REQ-026 |
| M7 | Lowball Carbon View: accessible input, Tension Counter, ARIA live region, reveal screen | REQ-011, REQ-022 |
| M8 | Spoiler-Safe Share Module | REQ-014, REQ-015, REQ-016, REQ-048, REQ-057 |
| M9 | Hub Registry manifest entry; full E2E journey validation report | REQ-025, REQ-058 |

## Quality Gates

**Gate G0 (M0 exit):**
- Entry: repository initialized, spec pack docs present.
- Exit: CI pipeline executes on a no-op commit; vendored GloVe/SCOWL files confirmed absent from git tracking (RISK-006 partial mitigation).

**Gate G1 (M1–M2 exit, "content correctness"):**
- Entry: corpus loader and formula module code-complete.
- Exit: panel_score_formula.feature scenarios pass (TEST identifiers under REQ-009/REQ-010 coverage); content_build_fairness_gate.feature all six admission criteria pass individually and combined; empirical pass-rate ≥120 admitted categories out of ≤1045 candidates verified.

**Gate G2 (M3 exit, "pack integrity"):**
- Entry: serializer implemented.
- Exit: content_pack_build_and_size.feature passes; CI fails build if serialized pack exceeds the REQ-045 ceiling; build report confirms zero GloVe bytes present in output artifact.

**Gate G3 (M4 exit, "engine determinism"):**
- Entry: engine module code-complete against REQ-001, REQ-004, REQ-005, REQ-006.
- Exit: daily_category_selection.feature cross-platform scenarios pass identically on iOS WKWebView, Android WebView, Desktop Chrome, Desktop Safari (AC-TEST-002); answer_validation.feature and scoring_and_verdict.feature pass with zero exceptions thrown for any player-input path.

**Gate G4 (M5 exit, "persistence integrity"):**
- Entry: Hub Shell Integration Layer code-complete.
- Exit: persistence_and_schema_migration.feature passes for valid-schema no-op, migratable-schema migration, corrupt-discard, independent Daily/Practice migration, players.length>1 repair (REQ-058), empty-category-array PackUnavailable (REQ-019); no code path throws on corrupt Save State.

**Gate G5 (M6 exit, "isolation integrity"):**
- Entry: Practice Mode code-complete.
- Exit: practice_mode_isolation.feature AC-012-01 and AC-012-02 pass; static dependency-graph check confirms no import path from Practice code into `updateStatsRecord`; dev-mode assertion (AC-012-04) fires on any attempted cross-write in test harness; RISK-004 status updated to Resolved.

**Gate G6 (M7 exit, "accessibility conformance"):**
- Entry: Carbon View code-complete.
- Exit: accessibility.feature passes with zero axe-core critical violations; ARIA live region announces score per submission; non-bar textual score channel present; tie-at-parValue announced as loss (AC-022-05); reduced-motion mid-drain toggle behavior matches AC-006-04.

**Gate G7 (M8 exit, "share safety"):**
- Entry: Share Module code-complete.
- Exit: share_module.feature passes; unit test confirms `generateShareText` output contains no substring equal to either submitted answer word for a corpus of generated test cases; Practice-mode share text carries the REQ-048 "(Practice)" marker; share invocation blocked while verdict is `"pending"` (REQ-057).

**Gate G8 (M9 exit, "release readiness"):**
- Entry: all prior gates G0–G7 passed.
- Exit: full_journey_e2e.feature passes end-to-end for both same-day reopen and next-day rollover scenarios; hub_registration_and_routing.feature confirms manifest entry and precache-before-first-play; Coverage Matrix confirms all REQ-001..REQ-058 have at least one associated TEST-XXX with passing status; RISK register reviewed with no Critical-severity item in Open status.

---