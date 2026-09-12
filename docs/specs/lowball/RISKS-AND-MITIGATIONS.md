# RISKS-AND-MITIGATIONS.md

## Risk Register

| RISK-XXX | Description | Severity | Likelihood | Mitigation | Owner | Trigger-to-Revisit |
|---|---|---|---|---|---|---|
| RISK-001 | ADR-007 (`parValue > 0` gate) not codified into the Fairness Gate as a testable admission criterion, permitting an unwinnable category (par = 0) into the Content Pack | CRITICAL | 1 (resolved) | Codified as sixth Fairness Gate criterion via REQ-042; implemented in Phase 4 (TASK-4.6) and verified by `content_build_fairness_gate.feature` | Build Tool owner (C-006) | Any Fairness Gate refactor that reorders or removes gate criteria evaluation |
| RISK-002 | Answer List completeness is the sole runtime validator (ADR-002, no shipped dictionary); a single corpus omission at build time permanently mis-rejects a valid word for that category's lifetime, with no runtime escape hatch | CRITICAL | 3 | No secondary-wordlist cross-validation implemented in this roadmap; residual exposure at Phases 2, 3, 11, 34, 40. Recommend post-launch content-patch mechanism (new `contentPackVersion`) as documented escape hatch, and opt-in dev diagnostic logging of rejected-but-plausible submissions | Build Tool owner (C-006) | Any player-reported false-negative validation, or any post-launch corpus audit finding |
| RISK-003 | REQUIREMENTS.md was originally truncated mid-REQ-004, leaving answer validation, scoring, tick advancement, verdict computation, share generation, Practice selection, and accessibility unspecified despite architecture assuming them | CRITICAL | 1 (resolved) | Full REQ-004..REQ-058 authored and traced to Engine/Hub Shell phases (Phases 9, 10, 12, 13, 22); Gate G3/G4 exit criteria require zero-exception coverage across these REQ IDs | Requirements Author | Any future spec-pack revision that reintroduces an unnumbered/untested behavior |
| RISK-004 | Practice→Daily/Stats cross-write prevention (ERROR-006) relies on structural namespacing + lint/test discipline with no runtime-enforced invariant | HIGH | 2 (post-mitigation) | Dev-mode runtime assertion (AC-012-04, Phase 26, TASK-26.1) added atop structural namespacing (Phase 17, 27); static dependency-graph CI check (Phase 27, TASK-27.1) blocks reintroduction of an import path into `updateStatsRecord` | Hub Shell / C-003 Owner | Any CI failure of the static dependency-graph check, or any dev-mode assertion firing in test harness |
| RISK-005 | Multi pack-version coexistence during transition windows (precache retention policy for N-1 versions) remains unresolved; no dedicated ADR exists | HIGH | 3 | Partially mitigated for single-day scope via `contentPackVersion` pinning at round start (REQ-020, Phase 25); multi-version coexistence itself remains open and out of this delivery's scope (see PROJECT-PLAN Non-Goals) | Architect | Any Content Pack version bump event, or any Save State migration spanning two pack versions |
| RISK-006 | Vendored GloVe file (163 MB, gitignored) is a single point of failure for reproducible builds; no checksum/provenance/backup strategy documented | MED | 2 | Partial mitigation via `.gitignore` exclusion rules (Phase 0, TASK-0.2) and CI confirmation that vendored assets are absent from git tracking (Gate G0); checksum-pinned fetch script and CI cache keyed by checksum recommended but not implemented in this roadmap | DevOps | Any build failure attributable to missing/corrupt vendored corpus, or any CI cache-miss incident |
| RISK-007 | FNV-1a hash collision or off-by-one in modulo-into-category-index mapping could select an inadmissible/excluded category | MED | 1 (resolved) | Hash-to-index mapping restricted to the currently admitted category set (Phase 8, TASK-8.2), closing the risk at Engine layer; verified by `daily_category_selection.feature` cross-platform scenarios | Engine Owner (C-001) | Any Content Pack admission-count change affecting the modulo space |
| RISK-008 | `updateStatsRecord` failure handling could silently desync the Stats Record from actual Daily verdict history | MED | 1 (resolved) | Detect-and-retry-once reconciliation on next Daily load (REQ-030, Phase 24, TASK-24.1); Daily-only invocation restriction (REQ-021, Phase 23) | Hub Shell / C-003 Owner | Any observed Stats Record / verdict-history mismatch in production telemetry-free diagnostics |
| RISK-009 | Reduced Motion + accessibility acceptance criteria exist only narratively with no numbered REQ/TEST guaranteeing WCAG 2.1 AA conformance | MED | 2 | Addressed via REQ-022 family across Phases 29–33, 39; axe-core zero-critical-violations CI gate (Phase 39, TASK-39.1) plus manual screen-reader test script (TASK-39.2); status remains partial until Gate G6/G8 final closure check | View Owner (C-005) / QA | Any axe-core violation regression, or any manual screen-reader test script failure |
| RISK-010 | Practice category "deterministic distinctness" algorithm was described ambiguously (randomizable vs deterministic), risking inconsistent implementation | MED | 1 (resolved) | Exact algorithm pinned via REQ-024/REQ-025 (Phase 16, TASK-16.1/16.2), including single-category-pack fallback (BRANCH-004); verified by `practice_mode_isolation.feature` category-selection scenario | Hub Shell / C-003 Owner | Any Content Pack category-count change affecting practice-selection candidate pool |
| RISK-011 | Schema migration logic had no specified migration function contract or versioning strategy | MED | 1 (resolved) | Migration function signature specified per REQ-029 (Phase 19, TASK-19.1); independent per-storage-key migration execution (Phase 21) | Hub Shell / C-003 Owner | Any future Save State schema-version bump |
| RISK-012 | Content Pack size target (~150 KB) had no CI-enforced hard ceiling/regression test | LOW | 1 (resolved) | Explicit REQ-045 CI size-ceiling check (Phase 7, TASK-7.2) failing the build on oversize synthetic fixture | Build Tool Owner (C-006) | Any Content Pack category-count increase approaching the ceiling |
| RISK-013 | Concurrency / last-write-wins (EDGE-004) is an accepted limitation; Practice's higher expected replay frequency (single-slot overwrite, Phase 28) increases exposure | LOW | 2 | Accepted limitation; no additional engineering action planned; monitored via QA exploratory testing during Phase 28/31 | QA / Test Lead | Any player-reported data-loss incident tied to multi-tab concurrent Practice play |

## Severity Method

Severity is scored per the fixed rubric supplied upstream:
- **CRITICAL** — blocks production launch; no workaround exists (e.g., RISK-001, RISK-002, RISK-003).
- **HIGH** — blocks a milestone; a workaround exists but is costly (e.g., RISK-004, RISK-005).
- **MED** — degrades quality; a feasible workaround exists (e.g., RISK-006 through RISK-011).
- **LOW** — cosmetic or future-only concern (e.g., RISK-012, RISK-013).

Each risk's severity was carried forward verbatim from the upstream spec pack RISKS section where an explicit rating existed, cross-checked against the CRITICAL/HIGH/MED/LOW definitions above, and re-validated against current resolution status (a risk resolved by a shipped REQ retains its original severity classification for register completeness but is annotated with reduced post-mitigation likelihood). Likelihood is scored 1 (rare) to 5 (near-certain) based on: (a) whether the originating condition is structurally prevented (likelihood 1), (b) whether it depends on residual human/process discipline (likelihood 2–3), or (c) whether it is an accepted, monitored limitation with no further mitigation planned (likelihood 2, bounded exposure).

## Top-N Risks

Ordered by severity × likelihood (severity weight: CRITICAL=4, HIGH=3, MED=2, LOW=1):

1. **RISK-002** (CRITICAL × 3 = 12) — Answer List completeness single-point-of-failure; only CRITICAL risk with residual open likelihood > 1.
2. **RISK-005** (HIGH × 3 = 9) — Multi pack-version coexistence unresolved; active open risk with real trigger surface (any version bump).
3. **RISK-009** (MED × 2 = 4) — Accessibility conformance partially open pending final axe-core/manual audit closure.
4. **RISK-004** (HIGH × 2 = 6) — Cross-write prevention now has dev-mode + static-analysis backstops but residual reliance on test-harness discipline.
5. **RISK-013** (LOW × 2 = 2) — Concurrency limitation, accepted but monitored.
6. **RISK-006** (MED × 2 = 4) — Vendored asset provenance/backup gap, open, bounded to build environment.
7. **RISK-001** (CRITICAL × 1 = 4) — Resolved; retained at top tier due to CRITICAL severity classification despite likelihood 1.
8. **RISK-003** (CRITICAL × 1 = 4) — Resolved; retained at top tier due to CRITICAL severity classification despite likelihood 1.
9. **RISK-007** (MED × 1 = 2) — Resolved at Engine layer.
10. **RISK-011** (MED × 1 = 2) — Resolved via REQ-029.

*(Re-ranked list above intentionally reorders by computed product rather than table order; RISK-004's product (HIGH=3 × 2 = 6) places it above RISK-009 in strict numeric terms — presented per computed value in the ordering above.)*

## Cross-References

| RISK-XXX | REQ-XXX Cross-Reference | Roadmap Phase(s) |
|---|---|---|
| RISK-001 | REQ-042 | Phase 4 (Fairness Gate), Phase 5 (Par Value Computation) |
| RISK-002 | (no REQ authored — accepted residual, see ATOMICITY-REPORT.md), TERM-009, ADR-002 | Phase 2 (Candidate Enumeration), Phase 3 (Panel Score Formula), Phase 11 (Panel Score & Findability Lookup), Phase 34 (shareText Generation), Phase 40 (Full Journey E2E) |
| RISK-003 | REQ-002, REQ-003, REQ-004..REQ-058 | Phase 9 (Round State Initialization), Phase 10 (Answer Validation), Phase 12 (Tick Counter), Phase 13 (Verdict Computation), Phase 22 (Players.length>1 Repair) |
| RISK-004 | REQ-022, REQ-023 | Phase 17 (Storage Key Namespacing), Phase 21 (Independent Migration), Phase 26 (Dev-Mode Invariant Assertion), Phase 27 (Static Dependency-Graph Check) |
| RISK-005 | REQ-001, REQ-002, REQ-003 | Phase 15 (Daily Category Resolution), Phase 18 (UTC Day Computation), Phase 25 (contentPackVersion Pinning), Phase 37 (Hub Registry) |
| RISK-006 | ERROR-008 | Phase 0 (Repository & Toolchain Setup), Phase 1 (Corpus Ingestion), Phase 38 (Precache Wiring) |
| RISK-007 | REQ-001 | Phase 8 (FNV-1a Category Hashing) |
| RISK-008 | REQ-030 | Phase 23 (Stats Record Update), Phase 24 (Stats Record Reconciliation Retry) |
| RISK-009 | REQ-049, REQ-050, REQ-051, REQ-052 | Phase 12 (Tick Counter, partial), Phase 29–33 (Carbon View), Phase 39 (axe-core CI Gate) |
| RISK-010 | REQ-024, REQ-025 | Phase 16 (Practice Category Selection) |
| RISK-011 | REQ-029 | Phase 19 (Schema Migration Contract), Phase 20 (Corrupt Save State Discard) |
| RISK-012 | REQ-045 | Phase 6 (Pack Serialization), Phase 7 (Size Ceiling CI Guard) |
| RISK-013 | EDGE-004, EDGE-009 | Phase 28 (Single-Slot Overwrite), Phase 31 (Reduced Motion Handling) |

> **Local correction (start-project Phase 2 post-check).** The orchestrator's original
> cross-reference table mis-mapped five rows against the hardened REQUIREMENTS.md. Corrected here:
> RISK-004 cited REQ-012/013 (terminal-submission and total-sum) where Practice isolation is
> REQ-022/023; RISK-009 cited REQ-022 (practice storage key) where accessibility is REQ-049..052;
> RISK-005 and RISK-008 each cited an unrelated tick-counter REQ (REQ-020, REQ-021); and RISK-002
> cited "REQ-004 (pending upstream)" although REQ-004 exists and covers admitted-set mapping, not
> Answer List completeness. RISK-002 has no REQ by decision — it is the accepted residual
> consequence of ADR-002, recorded in ATOMICITY-REPORT.md.

### Honesty constraint (carried from REQ-053)

The planning pack as generated omitted the panel-score honesty constraint. Restating it here so it
is not lost downstream: panel scores are a **derived statistical model**, not a survey of real
people. REQ-053 requires the UI to render the literal text
`simulated panel of 100 · from corpus frequency` wherever a score is shown, and TEST-090 asserts the
phrase "we asked 100 people" never appears. The repository README's existing "ground-truth data
only" claim does not hold for this game and must not be extended to it.

---