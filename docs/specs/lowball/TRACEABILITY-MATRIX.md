## Six-Level Trace Table

| Journey-Step | Field/Branch | REQ | AC | Test (TEST-XXX) | Code-Symbol |
|---|---|---|---|---|---|
| JOURNEY-001: dayId/categoryId hashing | FIELD-001 dayId, FIELD-004 categoryId | REQ-001 | AC-001-1 | TEST-001 | |
| JOURNEY-001: dayId/categoryId hashing | FIELD-002 contentPackVersion, FIELD-004 categoryId | REQ-001 | AC-001-2 | TEST-002 | |
| JOURNEY-001: dayId/categoryId hashing | FIELD-001 dayId (same UTC day) | REQ-002 | AC-002-1 | TEST-003 | |
| JOURNEY-001: dayId/categoryId hashing | FIELD-018 verdict pending, sweepIndex rollover reset | REQ-003 | AC-003-1 | TEST-004 | |
| JOURNEY-001: dayId/categoryId hashing | Stats Record played count vs. stale round | REQ-003 | AC-003-2 | TEST-005 | |
| JOURNEY-001: dayId/categoryId hashing | admitted category set (BRANCH: category mapping) | REQ-004 | AC-004-1 | TEST-006 | |
| JOURNEY-001: dayId/categoryId hashing | BRANCH: zero admitted categories | REQ-004 | AC-004-2 | TEST-007 | |
| JOURNEY-001: answer validation | FIELD-008 answerWord normalisation | REQ-005 | AC-005-1 | TEST-008 | |
| JOURNEY-001: answer validation | normalisation idempotence | REQ-005 | AC-005-2 | TEST-009 | |
| JOURNEY-001: answer validation | BRANCH: absent-from-Answer-List | REQ-006 | AC-006-1 | TEST-010 | |
| JOURNEY-001: answer validation | BRANCH: absent-from-Answer-List (no throw) | REQ-006 | AC-006-2 | TEST-011 | |
| JOURNEY-001: answer validation | BRANCH: affix-pattern suffix failure | REQ-007 | AC-007-1 | TEST-012 | |
| JOURNEY-001: answer validation | BRANCH: affix-pattern prefix failure | REQ-007 | AC-007-2 | TEST-013 | |
| JOURNEY-001: answer validation | BRANCH: repeated answer (exact) | REQ-008 | AC-008-1 | TEST-014 | |
| JOURNEY-001: answer validation | FIELD-024 isDuplicateOfEarlierAnswer | REQ-008 | AC-008-2 | TEST-015 | |
| JOURNEY-001: answer validation | BRANCH: empty submission (whitespace) | REQ-009 | AC-009-1 | TEST-016 | |
| JOURNEY-001: answer validation | BRANCH: empty submission (digits-only) | REQ-009 | AC-009-2 | TEST-017 | |
| JOURNEY-001: answer validation | FIELD-009 panelScore assignment (0) | REQ-010 | AC-010-1 | TEST-018 | |
| JOURNEY-001: answer validation | FIELD-009 panelScore assignment (100) | REQ-010 | AC-010-2 | TEST-019 | |
| JOURNEY-001: panelScore/tickCounter | FIELD-018 (implicit) sweepIndex advance, valid answer | REQ-011 | AC-011-1 | TEST-020 | |
| JOURNEY-001: panelScore/tickCounter | sweepIndex advance, invalid answer | REQ-011 | AC-011-2 | TEST-021 | |
| JOURNEY-001: panelScore/tickCounter | BRANCH: terminal round submission (state unchanged) | REQ-012 | AC-012-1 | TEST-022 | |
| JOURNEY-001: panelScore/tickCounter | BRANCH: terminal round submission (error marker) | REQ-012 | AC-012-2 | TEST-023 | |
| JOURNEY-001: totalScore/verdict | FIELD-017 totalScore (sum, non-zero) | REQ-013 | AC-013-1 | TEST-024 | |
| JOURNEY-001: totalScore/verdict | FIELD-017 totalScore (sum, zero) | REQ-013 | AC-013-2 | TEST-025 | |
| JOURNEY-001: totalScore/verdict | FIELD-017 totalScore uncapped (120) | REQ-014 | AC-014-1 | TEST-026 | |
| JOURNEY-001: totalScore/verdict | FIELD-017 totalScore uncapped (200) | REQ-014 | AC-014-2 | TEST-027 | |
| JOURNEY-001: totalScore/verdict | FIELD-018 verdict = win | REQ-015 | AC-015-1 | TEST-028 | |
| JOURNEY-001: totalScore/verdict | FIELD-018 verdict = loss (equal to par) | REQ-016 | AC-016-1 | TEST-029 | |
| JOURNEY-001: totalScore/verdict | FIELD-018 verdict = loss (above par) | REQ-016 | AC-016-2 | TEST-030 | |
| JOURNEY-001: totalScore/verdict | FIELD-018 verdict = pending | REQ-017 | AC-017-1 | TEST-031 | |
| JOURNEY-001: panelScore/tickCounter | FIELD-019 tickCounter init to 100 | REQ-018 | AC-018-1 | TEST-032 | |
| JOURNEY-001: panelScore/tickCounter | FIELD-019 tickCounter decrement (single call) | REQ-019 | AC-019-1 | TEST-033 | |
| JOURNEY-001: panelScore/tickCounter | FIELD-019 tickCounter decrement (repeated) | REQ-019 | AC-019-2 | TEST-034 | |
| JOURNEY-001: panelScore/tickCounter | FIELD-019 tickCounter hold at target | REQ-020 | AC-020-1 | TEST-035 | |
| JOURNEY-001: panelScore/tickCounter | FIELD-020 reducedMotion skip-drain (direct set) | REQ-021 | AC-021-1 | TEST-036 | |
| JOURNEY-001: panelScore/tickCounter | FIELD-020 reducedMotion skip-drain (never 100) | REQ-021 | AC-021-2 | TEST-037 | |
| JOURNEY-001: persistence | FIELD-027 (schemaVersion) persisted record | REQ-027 | AC-027-1 | TEST-046 | |
| JOURNEY-001: persistence | BRANCH: unmigratable state discarded | REQ-028 | AC-028-1 | TEST-047 | |
| JOURNEY-001: persistence | Practice-corrupt vs. Daily-intact isolation | REQ-028 | AC-028-2 | TEST-048 | |
| JOURNEY-001: persistence | migrate(state, fromVersion, toVersion) same-version | REQ-029 | AC-029-1 | TEST-049 | |
| JOURNEY-001: persistence | migrate(state, fromVersion, toVersion) unknown-version | REQ-029 | AC-029-2 | TEST-050 | |
| JOURNEY-001: persistence | Stats Record reconciliation (apply once) | REQ-030 | AC-030-1 | TEST-051 | |
| JOURNEY-001: persistence | Stats Record reconciliation (no double-count) | REQ-030 | AC-030-2 | TEST-052 | |
| JOURNEY-001: persistence | FIELD-016 players array repair to 1 entry | REQ-058 | AC-058-1 | TEST-098 | |
| JOURNEY-002: storageKeyPractice isolation | FIELD-022 storageKeyPractice write, FIELD-021 storageKeyDaily untouched | REQ-022 | AC-022-1 | TEST-038 | |
| JOURNEY-002: storageKeyPractice isolation | TERM-011 Stats Record exclusion (win) | REQ-023 | AC-023-1 | TEST-039 | |
| JOURNEY-002: storageKeyPractice isolation | TERM-011 Stats Record exclusion (loss) | REQ-023 | AC-023-2 | TEST-040 | |
| JOURNEY-002: selectPracticeCategory exclusion | Practice category selection determinism | REQ-024 | AC-024-1 | TEST-041 | |
| JOURNEY-002: selectPracticeCategory exclusion | Practice category admitted set (20 ordinals) | REQ-024 | AC-024-2 | TEST-042 | |
| JOURNEY-002: selectPracticeCategory exclusion | BRANCH: exclude Daily categoryId (collision) | REQ-025 | AC-025-1 | TEST-043 | |
| JOURNEY-002: selectPracticeCategory exclusion | BRANCH: single-category pack fallback | REQ-025 | AC-025-2 | TEST-044 | |
| JOURNEY-002: single-slot overwrite | FIELD-016 Practice Save State single-slot overwrite | REQ-026 | AC-026-1 | TEST-045 | |
| JOURNEY-003: GloVe/SCOWL loading | Fairness Gate criterion: 10-36 answers (lower bound) | REQ-031 | AC-031-1 | TEST-053 | |
| JOURNEY-003: GloVe/SCOWL loading | Fairness Gate criterion: 10-36 answers (upper bound exceeded) | REQ-031 | AC-031-2 | TEST-054 | |
| JOURNEY-003: Fairness Gate (6 criteria) | Fairness Gate criterion: high-scoring trap (boundary 45) | REQ-032 | AC-032-1 | TEST-055 | |
| JOURNEY-003: Fairness Gate (6 criteria) | Fairness Gate criterion: high-scoring trap (44 excluded) | REQ-032 | AC-032-2 | TEST-056 | |
| JOURNEY-003: Fairness Gate (6 criteria) | Fairness Gate criterion: six findable answers (6 admitted) | REQ-033 | AC-033-1 | TEST-057 | |
| JOURNEY-003: Fairness Gate (6 criteria) | Fairness Gate criterion: six findable answers (5 excluded) | REQ-033 | AC-033-2 | TEST-058 | |
| JOURNEY-003: Fairness Gate (6 criteria) | Fairness Gate criterion: findable zero-scorer (absent) | REQ-034 | AC-034-1 | TEST-059 | |
| JOURNEY-003: Fairness Gate (6 criteria) | Fairness Gate criterion: findable zero-scorer (present) | REQ-034 | AC-034-2 | TEST-060 | |
| JOURNEY-003: Fairness Gate (6 criteria) | Fairness Gate criterion: graded scoring ladder (4 non-zero excluded) | REQ-035 | AC-035-1 | TEST-061 | |
| JOURNEY-003: Fairness Gate (6 criteria) | Fairness Gate criterion: graded scoring ladder (3 distinct values excluded) | REQ-035 | AC-035-2 | TEST-062 | |
| JOURNEY-003: panelScore formula | FIELD-009/FIELD-012 GloVe-rank-based panelScore (100) | REQ-036 | AC-036-1 | TEST-063 | |
| JOURNEY-003: panelScore formula | FIELD-009/FIELD-012 GloVe-rank-based panelScore (6) | REQ-036 | AC-036-2 | TEST-064 | |
| JOURNEY-003: panelScore formula | BRANCH: out-of-vocabulary -> 0 | REQ-037 | AC-037-1 | TEST-065 | |
| JOURNEY-003: panelScore formula | BRANCH: specialist tier (FIELD-011 scowlTier) -> 0 | REQ-038 | AC-038-1 | TEST-066 | |
| JOURNEY-003: panelScore formula | FIELD-009 clamp 0-100 (rank 1) | REQ-039 | AC-039-1 | TEST-067 | |
| JOURNEY-003: panelScore formula | FIELD-009 clamp 0-100 (tail rank) | REQ-039 | AC-039-2 | TEST-068 | |
| JOURNEY-003: panelScore formula | BRANCH: non-finite formula result -> 0 | REQ-040 | AC-040-1 | TEST-069 | |
| JOURNEY-003: par computation | FIELD-013 parValue as median | REQ-041 | AC-041-1 | TEST-070 | |
| JOURNEY-003: par computation | BRANCH: parValue = 0 excluded (ADR-007) | REQ-042 | AC-042-1 | TEST-071 | |
| JOURNEY-003: par computation | BRANCH: parValue > 0 shipped-pack invariant | REQ-042 | AC-042-2 | TEST-072 | |
| JOURNEY-003: GloVe/SCOWL loading | BRANCH: missing GloVe vectors -> build fail (exit status) | REQ-043 | AC-043-1 | TEST-073 | |
| JOURNEY-003: GloVe/SCOWL loading | BRANCH: missing GloVe vectors -> build fail (error message) | REQ-043 | AC-043-2 | TEST-074 | |
| JOURNEY-003: pack serialization | Exclude derivation source data (no vector arrays) | REQ-044 | AC-044-1 | TEST-075 | |
| JOURNEY-003: pack serialization/size | BRANCH: size ceiling exceeded (201 KiB) | REQ-045 | AC-045-1 | TEST-076 | |
| JOURNEY-003: pack serialization/size | Size ceiling shipped-pack invariant (<=200 KB) | REQ-045 | AC-045-2 | TEST-077 | |
| JOURNEY-003: category-count | BRANCH: below minimum admitted category count (119) | REQ-046 | AC-046-1 | TEST-078 | |
| JOURNEY-003: category-count | Minimum admitted category count invariant (>=120) | REQ-046 | AC-046-2 | TEST-079 | |
| JOURNEY-004: spoiler-safe share text | FIELD-025 shareText excludes submitted answer words | REQ-047 | AC-047-1 | TEST-080 | |
| JOURNEY-004: spoiler-safe share text | FIELD-025 shareText excludes every Answer List entry | REQ-047 | AC-047-2 | TEST-081 | |
| JOURNEY-004: Practice share labelling | FIELD-025 shareText "(Practice)" marker present | REQ-048 | AC-048-1 | TEST-082 | |
| JOURNEY-004: Practice share labelling | FIELD-025 shareText "(Practice)" marker omitted for Daily | REQ-048 | AC-048-2 | TEST-083 | |
| JOURNEY-001: answer validation (a11y) | accessible name on answer input | REQ-049 | AC-049-1 | TEST-084 | |
| JOURNEY-004: findability badges | live region announcement of score | REQ-050 | AC-050-1 | TEST-085 | |
| JOURNEY-001: reveal | numeric panelScore rendered as text | REQ-051 | AC-051-1 | TEST-086 | |
| JOURNEY-004: findability badges | FIELD-010 isFindable badge distinction (findable) | REQ-052 | AC-052-1 | TEST-087 | |
| JOURNEY-004: findability badges | FIELD-010 isFindable badge distinction (none) | REQ-052 | AC-052-2 | TEST-088 | |
| JOURNEY-004: findability badges | disclosure of simulated panel origin (present) | REQ-053 | AC-053-1 | TEST-089 | |
| JOURNEY-004: findability badges | disclosure of simulated panel origin (misleading phrase omitted) | REQ-053 | AC-053-2 | TEST-090 | |
| JOURNEY-001 (via ENTRY-004): hub:init | Hub registry single Lowball entry | REQ-054 | AC-054-1 | TEST-091 | |
| JOURNEY-001 (via ENTRY-004): hub:init | Hub registry no duplicate identifiers | REQ-054 | AC-054-2 | TEST-092 | |
| JOURNEY-001: reveal/persistence | Network withheld at runtime (offline round completion) | REQ-055 | AC-055-1 | TEST-093 | |
| JOURNEY-001: reveal/persistence | Network withheld at runtime (only Content Pack asset) | REQ-055 | AC-055-2 | TEST-094 | |
| JOURNEY-001: engine purity | Engine free of platform effects (no forbidden imports) | REQ-056 | AC-056-1 | TEST-095 | |
| JOURNEY-001: engine purity | Engine free of platform effects (deterministic transitions) | REQ-056 | AC-056-2 | TEST-096 | |
| JOURNEY-004: share withheld until terminal | Share control absent while pending | REQ-057 | AC-057-1 | TEST-097 | |

## Forward Coverage

| Journey-Step | REQ(s) |
|---|---|
| JOURNEY-001: dayId/categoryId hashing | REQ-001, REQ-002, REQ-003, REQ-004 |
| JOURNEY-001: answer validation | REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-049 |
| JOURNEY-001: panelScore/tickCounter | REQ-011, REQ-012, REQ-018, REQ-019, REQ-020, REQ-021 |
| JOURNEY-001: totalScore/verdict | REQ-013, REQ-014, REQ-015, REQ-016, REQ-017 |
| JOURNEY-001: reveal | REQ-051, REQ-052, REQ-053 |
| JOURNEY-001: persistence | REQ-027, REQ-028, REQ-029, REQ-030, REQ-058 |
| JOURNEY-001 (via ENTRY-004 hub:init) | REQ-054 |
| JOURNEY-001: runtime constraints | REQ-055, REQ-056 |
| JOURNEY-002: storageKeyPractice isolation | REQ-022, REQ-023 |
| JOURNEY-002: selectPracticeCategory exclusion | REQ-024, REQ-025 |
| JOURNEY-002: single-slot overwrite | REQ-026 |
| JOURNEY-003: GloVe/SCOWL loading | REQ-036, REQ-037, REQ-038, REQ-043 |
| JOURNEY-003: panelScore formula | REQ-036, REQ-037, REQ-038, REQ-039, REQ-040 |
| JOURNEY-003: Fairness Gate (6 criteria incl. par>0) | REQ-031, REQ-032, REQ-033, REQ-034, REQ-035, REQ-042 |
| JOURNEY-003: par computation | REQ-041, REQ-042 |
| JOURNEY-003: pack serialization/size/category-count | REQ-044, REQ-045, REQ-046 |
| JOURNEY-004: findability badges | REQ-050, REQ-052, REQ-053 |
| JOURNEY-004: spoiler-safe share text | REQ-047 |
| JOURNEY-004: Practice share labelling | REQ-048 |
| JOURNEY-004: share withheld until terminal | REQ-057 |

## Backward Coverage

| REQ | Journey-Step(s) |
|---|---|
| REQ-001 | JOURNEY-001: dayId/categoryId hashing |
| REQ-002 | JOURNEY-001: dayId/categoryId hashing |
| REQ-003 | JOURNEY-001: dayId/categoryId hashing |
| REQ-004 | JOURNEY-001: dayId/categoryId hashing |
| REQ-005 | JOURNEY-001: answer validation |
| REQ-006 | JOURNEY-001: answer validation |
| REQ-007 | JOURNEY-001: answer validation |
| REQ-008 | JOURNEY-001: answer validation |
| REQ-009 | JOURNEY-001: answer validation |
| REQ-010 | JOURNEY-001: answer validation |
| REQ-011 | JOURNEY-001: panelScore/tickCounter |
| REQ-012 | JOURNEY-001: panelScore/tickCounter |
| REQ-013 | JOURNEY-001: totalScore/verdict |
| REQ-014 | JOURNEY-001: totalScore/verdict |
| REQ-015 | JOURNEY-001: totalScore/verdict |
| REQ-016 | JOURNEY-001: totalScore/verdict |
| REQ-017 | JOURNEY-001: totalScore/verdict |
| REQ-018 | JOURNEY-001: panelScore/tickCounter |
| REQ-019 | JOURNEY-001: panelScore/tickCounter |
| REQ-020 | JOURNEY-001: panelScore/tickCounter |
| REQ-021 | JOURNEY-001: panelScore/tickCounter |
| REQ-022 | JOURNEY-002: storageKeyPractice isolation |
| REQ-023 | JOURNEY-002: storageKeyPractice isolation |
| REQ-024 | JOURNEY-002: selectPracticeCategory exclusion |
| REQ-025 | JOURNEY-002: selectPracticeCategory exclusion |
| REQ-026 | JOURNEY-002: single-slot overwrite |
| REQ-027 | JOURNEY-001: persistence |
| REQ-028 | JOURNEY-001: persistence |
| REQ-029 | JOURNEY-001: persistence |
| REQ-030 | JOURNEY-001: persistence |
| REQ-031 | JOURNEY-003: Fairness Gate (6 criteria incl. par>0) |
| REQ-032 | JOURNEY-003: Fairness Gate (6 criteria incl. par>0) |
| REQ-033 | JOURNEY-003: Fairness Gate (6 criteria incl. par>0) |
| REQ-034 | JOURNEY-003: Fairness Gate (6 criteria incl. par>0) |
| REQ-035 | JOURNEY-003: Fairness Gate (6 criteria incl. par>0) |
| REQ-036 | JOURNEY-003: panelScore formula |
| REQ-037 | JOURNEY-003: panelScore formula |
| REQ-038 | JOURNEY-003: panelScore formula |
| REQ-039 | JOURNEY-003: panelScore formula |
| REQ-040 | JOURNEY-003: panelScore formula |
| REQ-041 | JOURNEY-003: par computation |
| REQ-042 | JOURNEY-003: par computation, JOURNEY-003: Fairness Gate (6 criteria incl. par>0) |
| REQ-043 | JOURNEY-003: GloVe/SCOWL loading |
| REQ-044 | JOURNEY-003: pack serialization/size/category-count |
| REQ-045 | JOURNEY-003: pack serialization/size/category-count |
| REQ-046 | JOURNEY-003: pack serialization/size/category-count |
| REQ-047 | JOURNEY-004: spoiler-safe share text |
| REQ-048 | JOURNEY-004: Practice share labelling |
| REQ-049 | JOURNEY-001: answer validation |
| REQ-050 | JOURNEY-004: findability badges |
| REQ-051 | JOURNEY-001: reveal |
| REQ-052 | JOURNEY-004: findability badges |
| REQ-053 | JOURNEY-004: findability badges |
| REQ-054 | JOURNEY-001 (via ENTRY-004: hub:init) |
| REQ-055 | JOURNEY-001: runtime constraints |
| REQ-056 | JOURNEY-001: runtime constraints |
| REQ-057 | JOURNEY-004: share withheld until terminal |
| REQ-058 | JOURNEY-001: persistence |

## AC ↔ Scenario Index

| AC-XXX | Scenario Name | Feature Path |
|---|---|---|
| AC-001-1 | Identical seed hashes to a byte-identical categoryId | req-001-daily-category-hash.feature |
| AC-001-2 | categoryId is identical across runtimes for a frozen historical seed | req-001-daily-category-hash.feature |
| AC-002-1 | Reopening the Daily Round on the same UTC day keeps categoryId unchanged | req-002-reject-daily-replay.feature |
| AC-003-1 | A stale pending round is reinitialised at sweepIndex 0 | req-003-utc-rollover-reset.feature |
| AC-003-2 | Reinitialising a stale round leaves the Stats Record played count unchanged | req-003-utc-rollover-reset.feature |
| AC-004-1 | Every mapped categoryId across 3650 consecutive days is admitted | req-004-constrain-category-selection.feature |
| AC-004-2 | A pack with zero admitted categories returns PackUnavailable instead of throwing | req-004-constrain-category-selection.feature |
| AC-005-1 | Raw submission is normalised to NFC, trimmed, lowercased and stripped | req-005-normalise-answer.feature |
| AC-005-2 | Normalisation is idempotent | req-005-normalise-answer.feature |
| AC-006-1 | An answer absent from the Answer List scores 100 | req-006-score-absent-answer.feature |
| AC-006-2 | An absent-answer submission returns state without throwing | req-006-score-absent-answer.feature |
| AC-007-1 | A real word failing the suffix pattern scores 100 | req-007-score-affix-mismatch.feature |
| AC-007-2 | A submission failing the prefix pattern scores 100 | req-007-score-affix-mismatch.feature |
| AC-008-1 | Repeating the exact Sweep 0 answer in Sweep 1 scores 100 | req-008-score-repeated-answer.feature |
| AC-008-2 | A normalised-equal repeat is flagged as a duplicate | req-008-score-repeated-answer.feature |
| AC-009-1 | A whitespace-only submission scores 100 | req-009-score-empty-submission.feature |
| AC-009-2 | A digits-only submission scores 100 | req-009-score-empty-submission.feature |
| AC-010-1 | A valid low-scoring answer is assigned its recorded panelScore of 0 | req-010-assign-precomputed-score.feature |
| AC-010-2 | A valid answer is assigned its recorded panelScore of 100 | req-010-assign-precomputed-score.feature |
| AC-011-1 | sweepIndex advances after a valid answer | req-011-advance-sweep-index.feature |
| AC-011-2 | sweepIndex advances after an invalid answer | req-011-advance-sweep-index.feature |
| AC-012-1 | A submission after two consumed Sweeps returns the state unchanged | req-012-refuse-terminal-submission.feature |
| AC-012-2 | A submission after two consumed Sweeps returns the no_sweeps_remaining marker | req-012-refuse-terminal-submission.feature |
| AC-013-1 | Total is the sum of two non-zero sweep scores | req-013-compute-total-score.feature |
| AC-013-2 | Total is zero when both sweep scores are zero | req-013-compute-total-score.feature |
| AC-014-1 | Two mid-range scores sum above 100 without clamping | req-014-total-uncapped.feature |
| AC-014-2 | Two maximum scores sum to 200 without clamping | req-014-total-uncapped.feature |
| AC-015-1 | totalScore strictly below parValue yields a win | req-015-declare-win.feature |
| AC-016-1 | totalScore equal to parValue yields a loss | req-016-declare-loss.feature |
| AC-016-2 | totalScore above parValue yields a loss | req-016-declare-loss.feature |
| AC-017-1 | verdict stays pending while sweepIndex is below 2 | req-017-verdict-pending.feature |
| AC-018-1 | tickCounter initialises to 100 after a sweep is scored | req-018-init-tick-counter.feature |
| AC-019-1 | A single advanceTick call decrements tickCounter by one | req-019-decrement-tick-counter.feature |
| AC-019-2 | Repeated advanceTick calls drive the counter down to the target | req-019-decrement-tick-counter.feature |
| AC-020-1 | advanceTick is a no-op once tickCounter equals panelScore | req-020-hold-tick-counter.feature |
| AC-021-1 | tickCounter is set directly to the target score under reduced motion | req-021-reduced-motion-skip-drain.feature |
| AC-021-2 | tickCounter never passes through 100 under reduced motion | req-021-reduced-motion-skip-drain.feature |
| AC-022-1 | Completing a full Practice Round leaves the Daily storage key untouched | req-022-practice-storage-key.feature |
| AC-023-1 | Winning a Practice Round leaves the Stats Record unchanged | req-023-exclude-practice-from-stats.feature |
| AC-023-2 | Losing a Practice Round leaves the Stats Record unchanged | req-023-exclude-practice-from-stats.feature |
| AC-024-1 | Identical seed selects the same Practice category twice | req-024-select-practice-category.feature |
| AC-024-2 | Every Practice selection across 20 ordinals is admitted | req-024-select-practice-category.feature |
| AC-025-1 | A colliding Practice selection advances to a different category | req-025-exclude-daily-category-from-practice.feature |
| AC-025-2 | A single-category pack returns the Daily category for Practice | req-025-exclude-daily-category-from-practice.feature |
| AC-026-1 | Starting a new Practice Round overwrites the prior stored round | req-026-single-practice-slot.feature |
| AC-027-1 | A persisted record contains a positive integer schemaVersion | req-027-persist-schema-version.feature |
| AC-028-1 | A malformed stored string yields a fresh round without throwing | req-028-discard-unmigratable-state.feature |
| AC-028-2 | A corrupt Practice record does not affect the intact Daily record | req-028-discard-unmigratable-state.feature |
| AC-029-1 | Migrating at the current schema version returns the input unchanged | req-029-migration-function-contract.feature |
| AC-029-2 | Migrating from an unknown schemaVersion returns null | req-029-migration-function-contract.feature |
| AC-030-1 | Loading an unreconciled win applies the Stats Record update once | req-030-reconcile-missing-stats.feature |
| AC-030-2 | Loading the same reconciled state again does not double-count | req-030-reconcile-missing-stats.feature |
| AC-031-1 | A candidate with exactly 10 answers is admitted | req-031-admit-answer-count-range.feature |
| AC-031-2 | A candidate with 37 answers is excluded | req-031-admit-answer-count-range.feature |
| AC-032-1 | A candidate whose top score is exactly 45 is admitted | req-032-admit-high-scoring-trap.feature |
| AC-032-2 | A candidate whose top score is 44 is excluded | req-032-admit-high-scoring-trap.feature |
| AC-033-1 | A candidate with exactly 6 findable answers is admitted | req-033-admit-findable-answers.feature |
| AC-033-2 | A candidate with 5 findable answers is excluded | req-033-admit-findable-answers.feature |
| AC-034-1 | A candidate whose zero-scorers are all unfindable is excluded | req-034-admit-findable-zero-scorer.feature |
| AC-034-2 | A candidate with one findable zero-scorer at tier 50 is admitted | req-034-admit-findable-zero-scorer.feature |
| AC-035-1 | A candidate with only 4 non-zero answers is excluded | req-035-admit-graded-scoring-ladder.feature |
| AC-035-2 | A candidate with 6 non-zero answers but only 3 distinct values is excluded | req-035-admit-graded-scoring-ladder.feature |
| AC-036-1 | A high-frequency findable word scores 100 | req-036-compute-panel-score-glove-rank.feature |
| AC-036-2 | A low-frequency findable word scores 6 | req-036-compute-panel-score-glove-rank.feature |
| AC-037-1 | An out-of-vocabulary answer scores zero | req-037-score-out-of-vocabulary.feature |
| AC-038-1 | A specialist-tier answer scores zero despite a resolved GloVe rank | req-038-score-specialist-tier.feature |
| AC-039-1 | A rank of 1 clamps to the maximum score of 100 | req-039-clamp-panel-score.feature |
| AC-039-2 | A tail-vocabulary rank clamps to at least zero | req-039-clamp-panel-score.feature |
| AC-040-1 | A GloVe rank of zero producing a non-finite logarithm scores zero | req-040-non-finite-formula-result.feature |
| AC-041-1 | Par is the median of five findable scores | req-041-compute-par-median.feature |
| AC-042-1 | A candidate yielding parValue 0 is excluded | req-042-exclude-zero-par.feature |
| AC-042-2 | Every admitted category in the shipped pack has a positive parValue | req-042-exclude-zero-par.feature |
| AC-043-1 | A missing GloVe file exits the build with a non-zero status | req-043-fail-build-missing-glove.feature |
| AC-043-2 | A missing GloVe file names the expected path in the error message | req-043-fail-build-missing-glove.feature |
| AC-044-1 | The serialised Content Pack contains no vector arrays | req-044-exclude-derivation-source-data.feature |
| AC-045-1 | A pack of 201 KiB exits the build with a non-zero status | req-045-fail-build-size-ceiling.feature |
| AC-045-2 | The shipped pack does not exceed the size ceiling | req-045-fail-build-size-ceiling.feature |
| AC-046-1 | Admitting 119 categories exits the build with a non-zero status | req-046-fail-build-min-category-count.feature |
| AC-046-2 | The shipped pack admits at least 120 categories | req-046-fail-build-min-category-count.feature |
| AC-047-1 | Share text omits neither submitted answer word | req-047-exclude-answer-words-from-share.feature |
| AC-047-2 | Share text omits every Answer List entry | req-047-exclude-answer-words-from-share.feature |
| AC-048-1 | Practice share text includes the "(Practice)" marker | req-048-label-practice-share-text.feature |
| AC-048-2 | Daily share text omits the "(Practice)" marker | req-048-label-practice-share-text.feature |
| AC-049-1 | The answer input exposes a non-empty accessible name | req-049-label-answer-input.feature |
| AC-050-1 | A sweep score is announced through the live region | req-050-announce-score-live-region.feature |
| AC-051-1 | The Tension Counter displays the numeric score as text | req-051-render-score-as-text.feature |
| AC-052-1 | A findable zero-scoring answer's badge differs from an unfindable badge | req-052-distinguish-findable-zero-scorers.feature |
| AC-052-2 | A non-zero-scoring answer renders no findability badge | req-052-distinguish-findable-zero-scorers.feature |
| AC-053-1 | The rendered view discloses the simulated panel origin | req-053-disclose-simulated-panel-origin.feature |
| AC-053-2 | The rendered view omits the misleading real-panel phrasing | req-053-disclose-simulated-panel-origin.feature |
| AC-054-1 | The registry contains exactly one Lowball entry | req-054-register-in-hub-registry.feature |
| AC-054-2 | No registry identifier appears twice | req-054-register-in-hub-registry.feature |
| AC-055-1 | A full round completes with the network offline | req-055-withhold-network-requests.feature |
| AC-055-2 | Only the Content Pack asset path appears among outbound requests | req-055-withhold-network-requests.feature |
| AC-056-1 | The engine module imports no forbidden platform interface | req-056-engine-free-of-platform-effects.feature |
| AC-056-2 | Repeated submission transitions with identical arguments are deep-equal | req-056-engine-free-of-platform-effects.feature |
| AC-057-1 | The share control is absent while the verdict is pending | req-057-withhold-share-control.feature |
| AC-058-1 | A Save State with three player entries is repaired to a single entry | req-058-repair-oversized-players-array.feature |

## Gaps + Orphans

**REQs without ACs:** None. Every REQ-001 through REQ-058 has at least one AC per the requirements pack.

**ACs without scenarios:** None. Every AC-XXX-N enumerated in the requirements pack has a corresponding scenario in the AC ↔ Scenario Index.

**Scenarios without ACs:** None. Every scenario in the supplied feature files carries an `@AC-XXX-N` tag mapping to a defined AC.

**Additional observations (non-blocking, carried from Risks/Missing-Edge-Cases for downstream awareness — not gaps in this matrix's coverage):**
- RISK-004: cross-write prevention (REQ-022) is verified only against `storageKeyDaily` non-modification (TEST-038); no corresponding AC/test targets a runtime-enforced invariant (structural/lint-only per architecture).
- RISK-007: FNV-1a hash collision/off-by-one fuzzing beyond TEST-006's 3650-day sample is not separately identified by its own REQ/AC/TEST id in this spec pack.
- Missing-Edge-Case items 1 (mid-round pack version upgrade), 2 (Practice category exhaustion across a session), 4 (multi-word/hyphenated corpus entries), 5 (stale Practice exclusion check after resume), 6 (near-miss UX messaging at totalScore==parValue), and 8 (reduced-motion toggled mid-drain) are recorded in the Risks document as unaddressed and have no corresponding REQ/AC/TEST id to trace in this matrix.
- JOURNEY-003 step "GloVe/SCOWL loading" has no distinct REQ for RISK-006 (GloVe file checksum-pinning) beyond REQ-043 (missing-file failure); checksum integrity is not separately traced.