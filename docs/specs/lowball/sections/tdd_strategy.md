# Test Plan

## Feature Files

```gherkin
# file: daily_category_selection.feature
Feature: Deterministic Daily Round category selection
  As the Lowball engine
  I need to compute a stable categoryId per UTC day
  So that all players worldwide see the same category

  @REQ-001 @AC-TEST-001 @unit
  Scenario: Identical seed inputs produce byte-identical categoryId
    Given a dayId "2024-06-01", a contentPackVersion "1.0.0", and a datasetId "lowball-core"
    When the engine computes categoryId twice using FNV-1a 32-bit hash over the seed
    Then both computed categoryId values are byte-identical

  @REQ-001 @AC-TEST-002 @cross-platform @regression
  Scenario Outline: categoryId is identical across all supported runtime platforms
    Given a frozen contentPackVersion "1.0.0" and a historical dayId "2024-01-15"
    When the engine computes categoryId on "<platform>"
    Then the resulting categoryId matches the canonical reference categoryId

    Examples:
      | platform            |
      | iOS WKWebView        |
      | Android WebView       |
      | Desktop Chrome browser |
      | Desktop Safari browser |

  @REQ-001 @unit @security
  Scenario: Engine performs no I/O while computing categoryId
    Given the engine is invoked with a valid Dataset Seed
    When computeCategoryId is called
    Then no storage access should occur
    And no network access should occur
    And no clock access should occur

  @REQ-001 @AC-ERROR-005 @unit @sad-path
  Scenario: Content Pack missing category data for computed categoryId
    Given a Content Pack that does not contain data for the computed categoryId
    When the Content Pack Accessor attempts to resolve the category
    Then a typed "PackUnavailable" result should be returned
    And the engine should NOT throw an exception
```

```gherkin
# file: daily_round_lifecycle.feature
Feature: Daily Round lifecycle across UTC day boundaries
  As a Player
  I want my Daily Round state to persist correctly within a day
  and reset correctly across day boundaries

  @REQ-002 @AC-TEST-003 @integration
  Scenario: Reopening the Daily Round on the same UTC day does not reassign category
    Given a Daily Save State with today's dayId and categoryId "X"
    When the Player reopens the Daily Round entry point
    Then categoryId remains "X"
    And no new categoryId is computed

  @REQ-002 @unit @security @unwanted
  Scenario: Engine does not recompute categoryId while saved dayId equals current dayId
    Given a Save State dayId equal to the current UTC dayId
    When the Daily Round entry point is opened
    Then the engine should NOT invoke computeCategoryId again

  @REQ-003 @AC-TEST-004 @integration
  Scenario: Stale Daily Save State triggers a fresh round on day rollover
    Given a saved dayId of yesterday with sweepIndex 1 pending
    When the Hub Shell loads the Daily Save State today
    Then a new round is initialized with sweepIndex 0
    And a new categoryId is computed for today's dayId
    And the verdict is set to "pending"
    And the old pending round is NOT counted toward the Stats Record

  @REQ-003 @NFR-005 @integration @sad-path
  Scenario: Loading a stale Daily Save State does not crash the Hub Shell
    Given a corrupted-but-parseable stale Daily Save State from a previous dayId
    When the Hub Shell loads it today
    Then the Hub Shell initializes a fresh round without throwing an exception
```

```gherkin
# file: answer_validation.feature
Feature: Submitted answer validation against the category Answer List
  As the Lowball engine
  I need to validate answers against the precomputed Answer List
  So that scoring is correct and cheating/invalid input is penalized

  @REQ-004 @AC-004-01 @unit
  Scenario: Valid answer present in Answer List is accepted
    Given a category with Answer List containing "though"
    When the Player submits "though"
    Then the submission is accepted as valid
    And the panelScore for "though" is looked up from the Content Pack

  @REQ-004 @AC-004-02 @unit @sad-path
  Scenario: Answer not present in the Answer List is rejected
    Given a category with Answer List not containing "zzznotaword"
    When the Player submits "zzznotaword"
    Then the submission is marked invalid
    And the sweep's panelScore is set to 100

  @REQ-004 @AC-004-03 @unit @edge-case
  Scenario: Duplicate answer across sweeps within the same round is rejected
    Given the Player already submitted "though" in sweep 0
    When the Player submits "though" again in sweep 1
    Then the submission is marked invalid due to duplication
    And the sweep's panelScore is set to 100

  @REQ-004 @AC-004-04 @unit @edge-case
  Scenario Outline: Input normalization before Answer List lookup
    Given a category with Answer List containing "ugh"
    When the Player submits "<raw_input>"
    Then the normalized submission matches "ugh"
    And the submission is accepted as valid

    Examples:
      | raw_input |
      | UGH        |
      | " ugh "    |
      | Ugh        |

  @REQ-004 @unit @security @unwanted
  Scenario: Engine never mutates raw storage input without validation
    Given a raw Save State object loaded from storage
    When the engine receives this object as input
    Then the engine should NOT trust it without schema validation performed upstream

  @REQ-004 @unit
  Scenario: Empty string submission is treated as invalid, not a crash
    Given an active round awaiting a submission
    When the Player submits an empty string ""
    Then the submission is marked invalid
    And the sweep's panelScore is set to 100
    And the engine does NOT throw an exception
```

```gherkin
# file: scoring_and_verdict.feature
Feature: Total score computation and win/loss verdict
  As the Lowball engine
  I need to sum both sweeps' panel scores and compare to par
  So that the Player receives a correct win/loss verdict

  @REQ-005 @AC-005-01 @unit
  Scenario: Total score is the sum of both sweep panel scores
    Given sweep 0 panelScore is 12
    And sweep 1 panelScore is 30
    When the round completes
    Then totalScore is 42

  @REQ-005 @AC-005-02 @unit
  Scenario Outline: Verdict is determined by comparing totalScore to parValue
    Given totalScore is <total>
    And parValue is <par>
    When the verdict is computed
    Then the verdict is "<verdict>"

    Examples:
      | total | par | verdict |
      | 40     | 50   | win      |
      | 50     | 50   | loss     |
      | 51     | 50   | loss     |
      | 0       | 5     | win      |
      | 150    | 100  | loss     |

  @REQ-005 @AC-005-03 @unit @edge-case
  Scenario: Total score above 100 is not treated as an automatic loss condition marker
    Given totalScore is 140
    And parValue is 160
    When the verdict is computed
    Then the verdict is "win"
    And no special-case "over 100" penalty is applied beyond the numeric comparison

  @REQ-005 @unit @regression
  Scenario: Score floor of zero prevents negative totalScore
    Given sweep 0 panelScore is 0
    And sweep 1 panelScore is 0
    When the round completes
    Then totalScore is 0
    And totalScore is never negative
```

```gherkin
# file: tension_counter.feature
Feature: 100-bar Tension Counter tick-driven drain
  As a Player
  I want a deterministic visual drain of the Tension Counter
  So that tension builds predictably and is fully testable

  @REQ-006 @AC-006-01 @unit
  Scenario: advanceTick decrements the tick counter by discrete steps
    Given a RoundState with tick 100 and a target score of 42
    When advanceTick is called
    Then the tick counter decreases by exactly one discrete step
    And the engine performs no wall-clock access

  @REQ-006 @AC-006-02 @unit
  Scenario: Tick counter drain halts exactly at target score
    Given a RoundState draining from tick 100 toward target score 42
    When advanceTick is called repeatedly until tick equals 42
    Then no further ticks are advanced below 42
    And the RoundState tick value equals 42

  @REQ-006 @AC-006-03 @optional @unit @a11y
  Scenario: Reduced motion enabled skips the drain and shows final score immediately
    Given reducedMotion is true
    And the target score is 42
    When the sweep result is rendered
    Then the Tension Counter displays 42 with no intermediate render frames
    And the outcome is fully perceivable without animation

  @REQ-006 @unit @regression
  Scenario: View schedules advanceTick calls, engine has no time awareness
    Given the engine's advanceTick function
    When inspected for dependencies
    Then it accepts only RoundState as an explicit input
    And it does NOT call Date.now() or any wall-clock API

  @REQ-006 @AC-006-04 @a11y @integration
  Scenario: Reduced motion toggled mid-drain is honored at the current sweep boundary
    Given a drain animation is actively in progress for the current sweep
    When prefers-reduced-motion changes to true mid-drain
    Then the View jumps immediately to the final score for the current sweep
    And subsequent sweeps continue to honor the updated setting
```

```gherkin
# file: content_build_fairness_gate.feature
Feature: Content Build Tool Fairness Gate admission criteria
  As the Content Build Tool
  I need to admit only categories meeting fairness criteria
  So that every published category is fair, spread, and findable

  @REQ-007 @AC-007-01 @unit
  Scenario: Category with fewer than 10 valid answers is rejected
    Given a candidate category with 9 valid answers
    When the Fairness Gate evaluates the category
    Then the category is excluded
    And the exclusion reason is "answer count below minimum"

  @REQ-007 @AC-007-02 @unit
  Scenario: Category with more than 36 valid answers is rejected
    Given a candidate category with 37 valid answers
    When the Fairness Gate evaluates the category
    Then the category is excluded
    And the exclusion reason is "answer count above maximum"

  @REQ-007 @AC-007-03 @unit
  Scenario: Category whose highest-scoring answer is below 45 is rejected
    Given a candidate category whose highest panelScore is 40
    When the Fairness Gate evaluates the category
    Then the category is excluded
    And the exclusion reason is "no genuine trap answer"

  @REQ-007 @AC-007-04 @unit
  Scenario: Category with fewer than 6 findable answers at tier 50 or better is rejected
    Given a candidate category with 5 findable tier-50-or-better answers
    When the Fairness Gate evaluates the category
    Then the category is excluded
    And the exclusion reason is "insufficient findable answers"

  @REQ-007 @AC-007-05 @unit
  Scenario: Category with no findable zero-scoring answer is rejected
    Given a candidate category whose only zero-scoring answers are all SCOWL tier 55 or higher
    When the Fairness Gate evaluates the category
    Then the category is excluded
    And the exclusion reason is "no findable zero-scorer"

  @REQ-007 @AC-007-06 @unit
  Scenario: Category with fewer than 5 non-zero answers spanning fewer than 4 distinct score values is rejected
    Given a candidate category with 5 non-zero answers all sharing the same 2 distinct score values
    When the Fairness Gate evaluates the category
    Then the category is excluded
    And the exclusion reason is "insufficient score spread"

  @REQ-007 @AC-007-07 @unit
  Scenario: Category satisfying all six admission criteria is admitted
    Given a candidate category with 20 valid answers
    And a highest panelScore of 60
    And 8 findable tier-50-or-better answers
    And at least one findable zero-scoring answer
    And 7 non-zero answers spanning 5 distinct score values
    And a parValue greater than 0
    When the Fairness Gate evaluates the category
    Then the category is admitted to the Content Pack

  @REQ-008 @AC-008-01 @unit @regression
  Scenario: Category with parValue of 0 is rejected (unwinnable category gate)
    Given a candidate category that otherwise passes all spread/findability criteria
    And its computed parValue is 0
    When the Fairness Gate evaluates the category
    Then the category is excluded
    And the exclusion reason is "unwinnable category: parValue not greater than zero"

  @REQ-007 @unit @edge-case
  Scenario: Empirical gate pass rate matches expected admitted category count
    Given the full candidate set of affix categories from the corpus
    When the Fairness Gate evaluates all candidates
    Then at least 120 categories are admitted
    And the admitted count does not exceed the known candidate ceiling of 1045
```

```gherkin
# file: panel_score_formula.feature
Feature: Simulated panel score formula honesty and correctness
  As the Content Build Tool
  I need to compute panel scores openly from GloVe rank and SCOWL tier
  So that scores are correct, documented, and never misrepresented as real survey data

  @REQ-009 @AC-009-01 @unit
  Scenario: Word out of GloVe vocabulary scores zero
    Given a word absent from the GloVe 6B 50d vocabulary
    When the panel score formula is applied
    Then the computed panelScore is 0

  @REQ-009 @AC-009-02 @unit
  Scenario: Word with SCOWL tier above 50 scores zero
    Given a word present in GloVe vocabulary
    And its SCOWL tier is 55
    When the panel score formula is applied
    Then the computed panelScore is 0

  @REQ-009 @AC-009-03 @unit
  Scenario Outline: Panel score formula computes correct clamped value for common words
    Given a word with GloVe rank <rank>
    And its SCOWL tier is <tier>
    When the panel score formula is applied
    Then the computed panelScore equals <expected_score> within tolerance 0.5

    Examples:
      | rank | tier | expected_score |
      | 10     | 10    | 100                |
      | 1000  | 20    | 45                  |
      | 50000 | 40    | 0                   |

  @REQ-009 @AC-009-04 @unit @regression
  Scenario: Panel score is always clamped within 0 to 100 inclusive
    Given any word with a valid GloVe rank and SCOWL tier
    When the panel score formula is applied
    Then the computed panelScore is >= 0
    And the computed panelScore is <= 100

  @REQ-010 @AC-010-01 @a11y @regression
  Scenario: UI displays the exact required honesty disclosure text
    Given the reveal screen is rendered after a completed round
    When the Player views the score explanation
    Then the text "simulated panel of 100 · from corpus frequency" is displayed verbatim

  @REQ-010 @AC-010-02 @regression @security
  Scenario: Product documentation never implies a real human survey occurred
    Given the specification and in-app copy for score explanation
    When scanned for prohibited claims
    Then no text asserts or implies "ground-truth" real human panel data
    And the build-time formula is documented openly in-repo
```

```gherkin
# file: findability_reveal.feature
Feature: Findable versus unfindable zero-scorer distinction on reveal
  As a Player
  I want to see whether my zero-scoring answer was genuinely findable
  So that winning does not feel hollow when luck alone produced a junk word

  @REQ-011 @AC-011-01 @e2e
  Scenario: Findable zero-scoring answer is visually distinguished on reveal
    Given the Player's submitted answer scored 0 and has SCOWL tier 50 or better
    When the reveal screen renders
    Then the answer is labeled as "findable"
    And a distinct visual badge is shown for findable zero-scorers

  @REQ-011 @AC-011-02 @e2e
  Scenario: Unfindable zero-scoring answer is visually distinguished on reveal
    Given the Player's submitted answer scored 0 and has SCOWL tier above 50
    When the reveal screen renders
    Then the answer is labeled as "unfindable"
    And a distinct visual badge is shown for unfindable zero-scorers

  @REQ-011 @AC-011-03 @unit
  Scenario: isFindable flag is read directly from Content Pack data, never recomputed at runtime
    Given a Content Pack answer entry with a precomputed isFindable flag
    When the engine looks up findability for a submitted answer
    Then the engine returns the precomputed isFindable value
    And the engine does NOT recompute GloVe rank or SCOWL tier at runtime
```

```gherkin
# file: practice_mode_isolation.feature
Feature: Practice Mode isolation from Daily Round and Stats Record
  As a Player
  I want to play unlimited Practice rounds
  Without affecting my Daily streak or Daily saved state

  @REQ-012 @AC-012-01 @integration
  Scenario: Practice Round persists under its own storage key
    Given the Player completes a Practice Round
    When the round state is persisted
    Then it is written to storageKeyPractice
    And storageKeyDaily is NOT modified

  @REQ-012 @AC-012-02 @integration @security
  Scenario: Practice Round completion never updates the Stats Record
    Given the Player completes a Practice Round with a "win" verdict
    When the round completes
    Then updateStatsRecord is NOT called
    And the Daily streak count remains unchanged

  @REQ-012 @AC-012-03 @unit @security @unwanted
  Scenario: Practice code path has no reachable reference to Daily storage key
    Given the Practice Round module dependency graph
    When statically analyzed
    Then no function reachable from the Practice code path references storageKeyDaily
    And no function reachable from the Practice code path references updateStatsRecord

  @REQ-012 @AC-012-04 @integration @regression
  Scenario: Dev-mode runtime assertion catches accidental cross-write attempt
    Given a non-production build with runtime invariant assertions enabled
    When a Practice code path attempts to write to storageKeyDaily
    Then an assertion error is thrown immediately in the dev-mode build
    And in production builds this path structurally cannot be reached

  @REQ-013 @AC-013-01 @unit
  Scenario: selectPracticeCategory deterministically excludes today's Daily category
    Given today's Daily categoryId is "D"
    When selectPracticeCategory is called with excludeCategoryId "D"
    Then the returned practiceCategoryId is never equal to "D"

  @REQ-013 @AC-013-02 @unit @regression
  Scenario: selectPracticeCategory is deterministic for identical inputs
    Given a dayId, exclusion categoryId, and attempt counter
    When selectPracticeCategory is called twice with identical inputs
    Then both calls return the identical practiceCategoryId

  @REQ-013 @AC-013-03 @unit @edge-case
  Scenario: Practice mode single-slot state is overwritten by each new Practice Round
    Given an existing persisted Practice Round under storageKeyPractice
    When the Player starts and completes a new Practice Round
    Then the previous Practice Round data is fully overwritten
    And no history of the prior round is retained in v1
```

```gherkin
# file: share_module.feature
Feature: Spoiler-safe share text generation
  As a Player
  I want to share my result
  Without ever revealing an answer word

  @REQ-014 @AC-014-01 @unit @security
  Scenario: generateShareText output never contains any answer word
    Given a completed round with totalScore 42, parValue 50, verdict "win", mode "daily"
    When generateShareText is called
    Then the returned string does NOT contain either submitted answer word as a substring

  @REQ-014 @AC-014-02 @unit
  Scenario: Share text includes numeric or bar representation of score versus par
    Given a completed round with totalScore 42, parValue 50, verdict "win", mode "daily"
    When generateShareText is called
    Then the returned string includes a representation of totalScore and parValue

  @REQ-014 @AC-014-03 @unit @security @unwanted
  Scenario: generateShareText function signature structurally cannot accept answer words
    Given the ShareInput type definition
    When inspected
    Then it contains only totalScore, parValue, verdict, and mode fields
    And it has no field capable of carrying an answer word

  @REQ-015 @AC-015-01 @unit
  Scenario: Practice mode share text is explicitly labelled and excludes streak language
    Given a completed Practice Round with totalScore 30, parValue 40, verdict "win", mode "practice"
    When generateShareText is called
    Then the returned string contains a "(Practice)" label
    And the returned string contains no streak or stats language

  @REQ-015 @AC-015-02 @unit
  Scenario: Daily mode share text contains no practice labelling
    Given a completed Daily Round with totalScore 42, parValue 50, verdict "win", mode "daily"
    When generateShareText is called
    Then the returned string does NOT contain a "(Practice)" label

  @REQ-016 @AC-016-01 @unwanted @integration @security
  Scenario: Share is not reachable while verdict is pending
    Given a round in progress with verdict "pending"
    When the Player attempts to reach the Share action
    Then the Share button should NOT be enabled or visible
    And no share text should be generated for a pending round
```

```gherkin
# file: persistence_and_schema_migration.feature
Feature: Schema-versioned persistence with repair-or-discard on corruption
  As the Hub Shell Integration Layer
  I need to validate and migrate persisted Save State
  So that corrupt data never crashes the app

  @REQ-017 @AC-017-01 @integration
  Scenario: Valid schema version loads without migration
    Given a persisted Save State with schemaVersion matching current version
    When Hub Shell loads the Save State
    Then the state loads successfully with no migration invoked

  @REQ-017 @AC-017-02 @integration
  Scenario: Outdated but migratable schema version is migrated
    Given a persisted Save State with schemaVersion 1
    And current schemaVersion is 2
    And a migration function migrate(state, 1, 2) exists
    When Hub Shell loads the Save State
    Then the state is migrated to schemaVersion 2
    And no exception is thrown

  @REQ-017 @AC-017-03 @integration @sad-path
  Scenario: Corrupt Save State that cannot be migrated is discarded, not crashed
    Given a persisted Save State that is malformed JSON or fails schema validation
    When Hub Shell loads the Save State
    Then the corrupt state is discarded
    And a fresh initial state is created
    And no exception propagates to the View

  @REQ-017 @AC-017-04 @integration @regression
  Scenario: Daily and Practice migration paths use identical migration scaffolding independently
    Given both storageKeyDaily and storageKeyPractice contain schemaVersion 1 data
    When Hub Shell loads both
    Then each is migrated independently using the same migrate() function contract
    And no cross-contamination occurs between the two migration calls

  @REQ-018 @AC-018-01 @integration @sad-path @edge-case
  Scenario: Save State with players.length greater than 1 in v1 is treated as corruption
    Given a tampered Save State containing 3 player entries
    When Hub Shell loads the Save State in v1
    Then the state is treated as corrupt
    And it is discarded and reinitialized with exactly one player slot

  @REQ-019 @AC-019-01 @integration @sad-path @edge-case
  Scenario: Content Pack loads successfully but contains zero categories
    Given an installed Content Pack that passes integrity check but has an empty category array
    When the Content Pack Accessor attempts to resolve any categoryId
    Then a typed "PackUnavailable" result is returned
    And the View renders an explicit offline-safe error state

  @REQ-020 @AC-020-01 @integration @regression
  Scenario: contentPackVersion is pinned to Save State at round start
    Given a round starts under contentPackVersion "1.2.0"
    When a service worker update installs contentPackVersion "1.3.0" mid-round
    Then the in-progress round continues scoring using pinned "1.2.0" Answer List and parValue
    And the round is unaffected by the mid-session update until completion

  @REQ-021 @AC-021-01 @integration
  Scenario: Stats Record update failure is retried on next Daily load
    Given a completed Daily Round with verdict persisted to Save State
    And the Stats Record update failed at completion time
    When the Player next opens the Daily Round entry point
    Then Hub Shell detects the verdict-not-reflected discrepancy
    And retries the Stats Record update exactly once
```

```gherkin
# file: accessibility.feature
Feature: WCAG 2.1 AA accessibility conformance
  As a Player using assistive technology
  I need accessible labels, live announcements, and non-visual score channels
  So that the game is fully usable without relying on the bar visualization alone

  @REQ-022 @AC-022-01 @a11y @e2e
  Scenario: Free-text answer input has a proper accessible label
    Given the Daily Round view is rendered
    When the answer input is inspected via accessibility tree
    Then it has an associated <label> or aria-label
    And it is announced correctly by screen readers

  @REQ-022 @AC-022-02 @a11y @e2e
  Scenario: Answer submission is announced via ARIA live region
    Given the Player submits a valid answer
    When the submission is processed
    Then an ARIA live region announces the score outcome
    And the announcement occurs without requiring focus change

  @REQ-022 @AC-022-03 @a11y @unit
  Scenario: The 100-bar Tension Counter is not the sole channel conveying the score
    Given a completed sweep with panelScore 42
    When the score is rendered
    Then a textual/numeric representation of 42 is also rendered
    And the numeric representation is programmatically determinable

  @REQ-022 @AC-022-04 @a11y @regression
  Scenario: Automated axe-core accessibility scan passes with zero critical violations
    Given the Daily Round view and Practice Round view are rendered
    When an axe-core scan is run against both views
    Then zero critical or serious WCAG 2.1 AA violations are reported

  @REQ-022 @AC-022-05 @a11y @e2e
  Scenario: Tie result at totalScore equal to parValue is announced clearly as a loss
    Given totalScore equals parValue exactly
    When the reveal screen renders and announces the verdict
    Then the ARIA live region and visible text both state the result is a loss
    And the messaging distinguishes this as a narrow miss rather than a generic loss
```

```gherkin
# file: content_pack_build_and_size.feature
Feature: Content Pack build integrity, size ceiling, and honesty invariants
  As the Content Build Tool
  I need to produce a valid, small, GloVe-free Content Pack
  So that the client bundle stays lean and licensing/size constraints hold

  @REQ-023 @AC-023-01 @integration @perf
  Scenario: Serialized Content Pack does not exceed the size ceiling
    Given a fully built Content Pack for the current version
    When its serialized size is measured
    Then it does not exceed 200 KB

  @REQ-023 @AC-023-02 @integration @security
  Scenario: Content Pack excludes raw GloVe vector data
    Given a fully built Content Pack
    When scanned for GloVe raw vector floats or vocabulary dumps
    Then no GloVe raw data is present in the serialized output

  @REQ-024 @AC-024-01 @integration @sad-path
  Scenario: Missing vendored GloVe file fails the build fast
    Given the vendored GloVe 6B 50d file is absent from the filesystem
    When the build tool is invoked
    Then the build fails immediately with a clear error message
    And no partial Content Pack is emitted

  @REQ-024 @AC-024-02 @integration @sad-path
  Scenario: Missing vendored SCOWL corpus fails the build fast
    Given the vendored SCOWL/wordkit corpus is absent from the filesystem
    When the build tool is invoked
    Then the build fails immediately with a clear error message
    And no partial Content Pack is emitted

  @REQ-023 @AC-023-03 @integration
  Scenario: Build report enumerates admitted and excluded category counts
    Given a completed build run
    When the build report is generated
    Then it lists the total admitted category count
    And it lists the total excluded category count with per-category gate failure reasons
```

```gherkin
# file: hub_registration_and_routing.feature
Feature: Hub registry integration and routing
  As the Hub Shell
  I need Lowball registered as a pluggable game
  So that Daily and Practice entry points route correctly

  @REQ-025 @AC-025-01 @integration
  Scenario: Lowball is registered in the hub's game manifest
    Given the hub registry is loaded at boot
    When the manifest is inspected
    Then an entry for Lowball exists with routes "/games/lowball" and "/games/lowball/practice"

  @REQ-025 @AC-025-02 @e2e
  Scenario: Navigating to the Daily route renders the Daily Round view
    Given the Player is on the hub home screen
    When the Player navigates to "/games/lowball"
    Then the Daily Round view is rendered with today's category

  @REQ-025 @AC-025-03 @e2e
  Scenario: Navigating to the Practice route renders the Practice Round view
    Given the Player is on the hub home screen
    When the Player navigates to "/games/lowball/practice"
    Then the Practice Round view is rendered with a category excluding today's Daily category

  @REQ-025 @AC-025-04 @integration
  Scenario: Content Pack precache completes before first gameplay
    Given the service worker install/update event has fired
    When the Player opens Lowball for the first time offline
    Then the Content Pack is already available from precache
    And no runtime network fetch is attempted
```

```gherkin
# file: full_journey_e2e.feature
Feature: End-to-end Daily Round journey
  As a Player
  I want to complete a full Daily Round from open to share
  So that the entire pipeline works together correctly

  @REQ-001 @REQ-004 @REQ-005 @REQ-011 @REQ-014 @e2e @regression
  Scenario: Full happy-path Daily Round journey
    Given the Player opens the Lowball Daily Round entry point for the first time today
    When the category is displayed
    And the Player submits a valid answer for sweep 0
    And the Tension Counter drains to the sweep 0 score
    And the Player submits a valid answer for sweep 1
    And the Tension Counter drains to the sweep 1 score
    Then the totalScore is computed as the sum of both sweeps
    And the verdict is computed by comparing totalScore to parValue
    And the reveal screen shows findable/unfindable badges for any zero-scoring answers
    And the Player can generate spoiler-safe share text
    And the Save State is persisted under storageKeyDaily
    And the Stats Record is updated for a Daily completion

  @REQ-002 @REQ-003 @e2e @regression
  Scenario: Reopen same day then reopen next day journey
    Given the Player completes a Daily Round today
    When the Player reopens the Daily Round entry point later the same day
    Then the completed round and verdict are still displayed, unchanged
    When the UTC day rolls over and the Player reopens the Daily Round entry point
    Then a brand-new round is initialized with a new category and sweepIndex 0
```

## Step Definitions

| Step Pattern | Type | Notes |
|---|---|---|
| `Given a dayId {string}, a contentPackVersion {string}, and a datasetId {string}` | Given | Constructs a Dataset Seed fixture |
| `Given a frozen contentPackVersion {string} and a historical dayId {string}` | Given | Loads fixed seed for cross-platform test |
| `When the engine computes categoryId twice using FNV-1a 32-bit hash over the seed` | When | Calls `computeCategoryId` twice, captures both results |
| `When the engine computes categoryId on {string}` | When | Runs the pure hash fn in a platform-specific test harness (WKWebView/Android WebView/browser runners) |
| `Then both computed categoryId values are byte-identical` | Then | Deep-equality assertion on hash output bytes |
| `Then the resulting categoryId matches the canonical reference categoryId` | Then | Compares against a stored golden value fixture |
| `Given a Content Pack that does not contain data for the computed categoryId` | Given | Injects a pack fixture missing the target entry |
| `When the Content Pack Accessor attempts to resolve the category` | When | Calls `getCategory(categoryId)` |
| `Then a typed {string} result should be returned` | Then | Asserts discriminated union result type, not thrown error |
| `Given a Daily Save State with today's dayId and categoryId {string}` | Given | Seeds storage fixture via test double |
| `When the Player reopens the Daily Round entry point` | When | Simulates `loadDailySave()` + view mount |
| `Then categoryId remains {string}` | Then | Asserts unchanged state field |
| `Given a saved dayId of yesterday with sweepIndex {int} pending` | Given | Seeds stale Save State fixture |
| `When the Hub Shell loads the Daily Save State today` | When | Invokes `loadDailySave()` with mocked `getUtcDayId()` returning "today" |
| `Then a new round is initialized with sweepIndex {int}` | Then | Asserts `sweepIndex` field on returned state |
| `Then the old pending round is NOT counted toward the Stats Record` | Then | Asserts `updateStatsRecord` mock was not called with stale data |
| `Given a category with Answer List containing {string}` | Given | Seeds minimal category+AnswerList fixture |
| `When the Player submits {string}` | When | Calls `submitAnswer(state, answer)` |
| `Then the submission is accepted as valid` / `Then the submission is marked invalid` | Then | Asserts validity flag on resulting sweep record |
| `Then a state object is returned and no exception is raised` | Then | Asserts the call returns state and throws nothing |
| `Then isDuplicateOfEarlierAnswer is true` | Then | Asserts the duplicate flag on the resulting sweep record |
| `Then the emitted message contains the expected GloVe file path` | Then | Substring assertion that stderr names the configured GloVe path |
| `When each answer in the round's Answer List is sought in the share text` | When | Iterates every Answer List entry against the generated share text |
| `Then no Answer List entry is found in the share text` | Then | Asserts none of the category's answers appear in the share text |
| `Then the share text omits {string}` | Then | Substring-absence assertion on the generated share text |
| `Then the share text contains {string}` | Then | Substring-presence assertion on the generated share text |
| `Given the raw submission {string}` | Given | Supplies a raw, un-normalised submission string |
| `When the submission is normalised` | When | Calls the engine's `normalize` function |
| `Then the normalised result equals {string}` | Then | String equality assertion on the normalised output |
| `Given an already-normalised string` | Given | Supplies a string that is already in normalised form |
| `When normalisation is applied a second time` | When | Calls `normalize` on the already-normalised value |
| `Then the result is unchanged` | Then | Asserts idempotence of normalisation |
| `Then the sweep's panelScore is set to {int}` | Then | Asserts `panelScore` field equals penalty/lookup value |
| `Given sweep {int} panelScore is {int}` | Given | Directly constructs partial RoundState fixture |
| `When the round completes` | When | Triggers verdict computation transition |
| `Then totalScore is {int}` | Then | Asserts summed score field |
| `Given totalScore is {int}` / `And parValue is {int}` | Given | Constructs verdict-input fixture |
| `When the verdict is computed` | When | Calls `getVerdict(state)` |
| `Then the verdict is {string}` | Then | Asserts `"win"`/`"loss"` string |
| `Given a RoundState with tick {int} and a target score of {int}` | Given | Constructs tick fixture |
| `When advanceTick is called` / `When advanceTick is called repeatedly until tick equals {int}` | When | Invokes `advanceTick` N times, capturing intermediate states |
| `Then the tick counter decreases by exactly one discrete step` | Then | Asserts delta of 1 per call |
| `Given reducedMotion is true` | Given | Sets `reducedMotion` plain input param |
| `When the sweep result is rendered` | When | Mounts View component with given state/flag |
| `Then the Tension Counter displays {int} with no intermediate render frames` | Then | Snapshot/render-count assertion via testing-library |
| `Given a candidate category with {int} valid answers` | Given | Constructs candidate category fixture for Build Tool |
| `When the Fairness Gate evaluates the category` | When | Calls Build Tool's gate function |
| `Then the category is excluded` / `Then the category is admitted to the Content Pack` | Then | Asserts gate decision boolean |
| `Then the exclusion reason is {string}` | Then | Asserts reason string/enum on gate result |
| `Given a word with GloVe rank {int}` / `And its SCOWL tier is {int}` | Given | Constructs word-frequency fixture |
| `When the panel score formula is applied` | When | Calls Build Tool's `computePanelScore` |
| `Then the computed panelScore equals {float} within tolerance {float}` | Then | Numeric assertion with epsilon |
| `Given the Player's submitted answer scored {int} and has SCOWL tier {int} or better/above` | Given | Constructs reveal fixture with findability flag |
| `When the reveal screen renders` | When | Mounts reveal component |
| `Then the answer is labeled as {string}` | Then | Asserts rendered badge text/class |
| `Given the Player completes a Practice Round` | Given | Runs full practice round through engine + persistence |
| `When the Practice round state is persisted` | When | Calls `persistPracticeSave(state)` for the completed practice round |
| `Given the Player completes a Practice Round ending in a {string} verdict` | Given | Runs a full practice round driven to the named terminal verdict |
| `Then the migrate return value is null` | Then | Asserts `migrate()` returned null for an unknown schemaVersion |
| `Then panelScore is greater than or equal to {int}` | Then | Asserts the computed score meets the given lower bound. Use ONLY for REQ-039 AC-039-2 clamp-floor checks; exact-zero cases (REQ-037, REQ-038, REQ-040) must use the `panelScore equals {int}` step instead |
| `Then panelScore equals {int}` | Then | Exact integer equality assertion on the computed panel score |
| `Given the plugin mounted with the network offline` | Given | Mounts the plugin with all network access disabled |
| `Then the round reaches a terminal verdict` | Then | Asserts the round's verdict is win or loss, not pending |
| `When the round state is persisted` | When | Calls `persistPracticeSave(state)` |
| `Then it is written to storageKeyPractice` / `Then storageKeyDaily is NOT modified` | Then | Asserts mock storage call keys and call-absence |
| `Then updateStatsRecord is NOT called` | Then | Asserts spy was never invoked |
| `Given the Practice Round module dependency graph` | Given | Loads module graph via static analysis tool (e.g. dependency-cruiser) |
| `When statically analyzed` | When | Runs lint/dependency-graph rule |
| `Then no function reachable from the Practice code path references {string}` | Then | Asserts absence in reachable call graph |
| `Given today's Daily categoryId is {string}` | Given | Seeds daily categoryId fixture |
| `When selectPracticeCategory is called with excludeCategoryId {string}` | When | Calls `selectPracticeCategory(excludeCategoryId)` |
| `Then the returned practiceCategoryId is never equal to {string}` | Then | Inequality assertion |
| `Given a completed round with totalScore {int}, parValue {int}, verdict {string}, mode {string}` | Given | Constructs `ShareInput` fixture |
| `When generateShareText is called` | When | Calls `generateShareText(input)` |
| `Then the returned string does NOT contain either submitted answer word as a substring` | Then | Substring-absence assertion against both answer fixtures |
| `Then the returned string contains a {string} label` | Then | Substring-presence assertion |
| `Given a round in progress with verdict {string}` | Given | Constructs pending RoundState fixture |
| `When the Player attempts to reach the Share action` | When | Simulates UI interaction/route guard check |
| `Then the Share button should NOT be enabled or visible` | Then | DOM assertion (disabled/hidden attribute) |
| `Given a persisted Save State with schemaVersion {int}` | Given | Seeds versioned storage fixture |
| `When Hub Shell loads the Save State` | When | Calls `loadDailySave()` / `loadPracticeSave()` |
| `Then the state is migrated to schemaVersion {int}` | Then | Asserts resulting `schemaVersion` field |
| `Then the corrupt state is discarded` | Then | Asserts fresh default state returned, no exception thrown |
| `Given a tampered Save State containing {int} player entries` | Given | Seeds malformed `players[]` array fixture |
| `Given an installed Content Pack that passes integrity check but has an empty category array` | Given | Seeds empty-array pack fixture |
| `Given a round starts under contentPackVersion {string}` | Given | Seeds Save State with pinned version field |
| `When a service worker update installs contentPackVersion {string} mid-round` | When | Simulates SW update event without altering in-memory round state |
| `Given the answer input is inspected via accessibility tree` | Given | Uses axe-core / testing-library `getByRole` |
| `Given a rendered round view` | Given | Mounts the Lowball view for the current round |
| `When the accessible name of the answer input is queried` | When | Reads the computed accessible name of the input element |
| `Then the accessible name is a non-empty string` | Then | Asserts the accessible name has length greater than zero |
| `Given a round at sweepIndex {int}` | Given | Constructs an `AttemptState` positioned at the given sweep index |
| `When a valid answer is submitted` | When | Calls `submitAnswer` with a word present in the Answer List |
| `When an invalid answer is submitted` | When | Calls `submitAnswer` with a word absent from the Answer List |
| `Then sweepIndex equals {int}` | Then | Numeric equality assertion on the `sweepIndex` field |
| `Given a Daily Save State holding a terminal {string} verdict for dayId {string}` | Given | Seeds a completed Daily record at the given verdict and day |
| `And a Stats Record omitting dayId {string}` | Given | Seeds a Stats Record whose playedDays excludes the given day |
| `When the Daily Save State is loaded` | When | Calls `loadDailySave()` and runs the reconciliation step |
| `Then the Stats Record records {int} win for dayId {string}` | Then | Asserts the win count attributed to the given day |
| `Then the Stats Record win count is unchanged` | Then | Asserts the win total equals the pre-load snapshot |
| `When the live region content is read` | When | Reads `textContent` of the view's ARIA live region |
| `Then the live region text contains {string}` | Then | Substring-presence assertion on the live region text |
| `Then the rendered view text contains {string}` | Then | Substring-presence assertion on the rendered view text |
| `Then the rendered view text omits {string}` | Then | Substring-absence assertion on the rendered view text |
| `When the registry entries are enumerated` | When | Reads the exported `GAMES` array from the hub registry |
| `Then one entry carries the identifier {string}` | Then | Asserts exactly one registry entry has the given `meta.id` |
| `Then no identifier appears twice` | Then | Asserts the set of registry identifiers has no duplicates |
| `When the Content Pack keys are enumerated` | When | Walks the serialised pack object's keys recursively |
| `Then no key holds a vector array` | Then | Asserts no key contains embedding/vector numeric arrays |
| `Given a serialised Content Pack of {int} kibibytes` | Given | Produces a pack fixture at the given serialised size |
| `When the size ceiling is checked` | When | Runs the Build Tool's size-ceiling assertion |
| `Then the build exits with a non-zero status` | Then | Asserts the process exit code is non-zero |
| `Then the serialised size is at most {int} kibibytes` | Then | Numeric upper-bound assertion on serialised byte length |
| `Given a Fairness Gate run admitting {int} categories` | Given | Produces a gate result fixture with the given admitted count |
| `When the admitted category count is checked` | When | Runs the Build Tool's minimum-category-count assertion |
| `Then the admitted category count is at least {int}` | Then | Numeric lower-bound assertion on admitted category count |
| `Given {int} consecutive dayId values` | Given | Generates the given number of sequential UTC dayIds |
| `When each dayId is mapped to a categoryId` | When | Runs the selection hash for every generated dayId |
| `Then every resulting categoryId exists in the admitted category set` | Then | Asserts set membership for every mapped categoryId |
| `Given a Content Pack declaring an admitted category count of {int}` | Given | Seeds a pack fixture with the given admitted count |
| `When category selection is attempted` | When | Calls the selection function against that pack |
| `Then a PackUnavailable result is returned without throwing` | Then | Asserts the typed unavailable result and that no exception was raised |
| `Given practice attempt ordinals {int} through {int} on one dayId` | Given | Enumerates the given inclusive ordinal range for a single dayId |
| `When each practice category is selected` | When | Calls `selectPracticeCategory` for every ordinal in the range |
| `Given dayId {string} and practice ordinal {int}` | Given | Fixes a single dayId plus practice attempt ordinal as the selection seed |
| `When the Practice category is selected twice` | When | Calls `selectPracticeCategory` twice with the identical seed |
| `Then both selections yield the same categoryId` | Then | Asserts the two returned categoryId values are equal |
| `When the round view is rendered for the disclosure check` | When | Mounts the view and captures its rendered text content |
| `Given a Content Pack holding exactly {int} admitted category` | Given | Seeds a degenerate single-category pack fixture |
| `Then the returned practiceCategoryId equals the Daily categoryId` | Then | Asserts equality with the Daily categoryId (degenerate single-category case) |
| `Given a completed round ready to persist` | Given | Constructs a terminal RoundState awaiting persistence |
| `When the round state is written to storage` | When | Calls the relevant persistence function |
| `Then the stored record contains a positive integer schemaVersion` | Then | Asserts `schemaVersion` is present and greater than zero |
| `Given a corrupt Practice record and an intact Daily record` | Given | Seeds a corrupt practice value alongside a known-good daily value |
| `When the Practice state is loaded` | When | Calls `loadPracticeSave()` against the corrupt record |
| `Then the Daily record is unchanged` | Then | Asserts the daily stored value is byte-identical to its snapshot |
| `When every admitted category is inspected` | When | Iterates all admitted categories in the shipped pack |
| `Then each parValue is greater than {int}` | Then | Asserts the par value of every admitted category exceeds the bound |
| `Given the plugin mounted with outbound requests recorded` | Given | Mounts the plugin behind a request-recording harness |
| `When a full round is played` | When | Drives both sweeps through to a terminal verdict |
| `Then only the Content Pack asset path appears among outbound requests` | Then | Asserts the recorded request list contains solely the pack asset path |
| `Given a candidate category whose top answer scores {int}` | Given | Constructs a candidate whose maximum panelScore is the given value |
| `Given a candidate category with {int} findable answers at tier 50 or better` | Given | Constructs a candidate with the given count of tier-≤50 answers |
| `Given a candidate category whose only zero-scorers sit at tier {int}` | Given | Constructs a candidate whose zero-scoring answers are all at the given tier |
| `Given a candidate category with {int} zero-scorer at tier {int}` | Given | Constructs a candidate with the given count of zero-scorers at the given tier |
| `Given a candidate category with {int} non-zero answers spanning {int} distinct score values` | Given | Constructs a candidate with the given ladder shape |
| `Given a candidate category yielding a parValue of {int}` | Given | Constructs a candidate whose computed par equals the given value |
| `When an axe-core scan is run against both views` | When | Runs `axe.run()` against rendered DOM |
| `Then zero critical or serious WCAG 2.1 AA violations are reported` | Then | Asserts empty violations array filtered by impact level |
| `Given a fully built Content Pack for the current version` | Given | Runs Build Tool CLI against fixture corpus |
| `When its serialized size is measured` | When | Reads `Buffer.byteLength` of output JSON |
| `Then it does not exceed {int} KB` | Then | Numeric threshold assertion |
| `Given the vendored GloVe 6B 50d file is absent from the filesystem` | Given | Test harness deletes/mocks file path |
| `When the build tool is invoked` | When | Spawns CLI process, captures exit code/stderr |
| `Then the build fails immediately with a clear error message` | Then | Asserts non-zero exit code + error message content |
| `Given the hub registry is loaded at boot` | Given | Loads registry fixture including Lowball manifest entry |
| `When the Player navigates to {string}` | When | Playwright/Cypress route navigation |
| `Then the Daily Round view is rendered with today's category` | Then | E2E DOM assertion on rendered category label |
| `Given a category whose findable answers score {string}` | Given | Constructs a candidate whose findable subset has explicit scores, e.g. "0, 2, 21, 41, 95" |
| `When parValue is computed` | When | Calls the Build Tool's `computePar(candidate)` |
| `Then parValue equals {int}` | Then | Numeric equality assertion on the returned par |
| `Given the Lowball engine module source` | Given | Reads the engine module file as text for static inspection |
| `When its import statements are inspected` | When | Parses import specifiers from the module source |
| `Then no import specifier references a storage, clock or document interface` | Then | Asserts no specifier matches the forbidden-effect list |
| `Given a submission transition and a fixed argument set` | Given | Constructs an `AttemptState` plus a fixed answer string |
| `When the transition is invoked twice with those same arguments` | When | Calls `submitAnswer` twice from the same input state |
| `Then both returned states are deep-equal` | Then | Structural deep-equality assertion on the two results |
| `Given a round whose verdict is {string}` | Given | Constructs a RoundState fixture at the given verdict |
| `When the round view is rendered` | When | Mounts the Lowball view with that state |
| `Then the share control is absent from the rendered view` | Then | DOM assertion that no share control is present |
| `Given a persisted Save State whose players array holds {int} entries` | Given | Seeds a tampered `players[]` fixture |
| `When the tampered Save State is loaded` | When | Calls `loadDailySave()` against the tampered fixture |
| `Then the repaired state holds exactly {int} player entry` | Then | Asserts `players.length` after repair |
| `Given a completed Practice round already stored under storageKeyPractice` | Given | Seeds `saveState.practice.existing` |
| `When a new Practice Round starts` | When | Calls `startPracticeRound()` then `persistPracticeSave(state)` |
| `Then Practice Save State holds only the new round` | Then | Asserts the stored record equals the new round and retains no prior round |
| `Given a sweep that has just been scored {int}` | Given | Constructs an `AttemptState` whose latest sweep carries the given panelScore |
| `When the sweep score is assigned` | When | Applies the score-assignment transition to the state |
| `Then tickCounter equals {int}` | Then | Numeric equality assertion on the `tickCounter` field |
| `Then tickCounter never holds the value {int} in the returned state` | Then | Asserts the returned state's tickCounter differs from the given value |
| `Given a Tension Counter displaying a score of {int}` | Given | Mounts the view with a scored state at the given panelScore |
| `When the rendered view text is queried` | When | Reads `textContent` of the rendered view root |
| `Then the numeric score appears as text` | Then | Asserts the score digits are present in the view text content |

## Test Fixtures

| Fixture Name | Description |
|---|---|
| `seed.fixture.basic` | `{ dayId: "2024-06-01", contentPackVersion: "1.0.0", datasetId: "lowball-core" }` — canonical Dataset Seed for hash determinism tests |
| `seed.fixture.historical` | Frozen historical `dayId`/`contentPackVersion` pair with a golden reference `categoryId` for cross-platform regression |
| `saveState.daily.sameDay` | Daily Save State fixture with `dayId = today`, `categoryId = "X"`, `sweepIndex = 1` |
| `saveState.daily.stale` | Daily Save State fixture with `dayId = yesterday`, `sweepIndex = 1`, `verdict = "pending"` |
| `saveState.daily.corrupt.malformed` | Deliberately malformed/invalid-schema Save State (bad JSON shape) for repair-or-discard tests |
| `saveState.daily.corrupt.multiPlayer` | Tampered Save State with `players.length = 3` for v1 corruption-handling test |
| `saveState.practice.existing` | Pre-existing Practice Save State to verify single-slot overwrite behavior |
| `saveState.schemaV1` | Legacy schemaVersion 1 Save State for migration path tests (Daily and Practice variants) |
| `category.fixture.minimal` | Minimal category + Answer List containing a small controlled word set (`"though"`, `"ugh"`) for validation scenarios |
| `category.fixture.fairnessGate.passing` | Candidate category meeting all six Fairness Gate criteria (answer count, top score, findable count, findable zero-scorer, spread, par > 0) |
| `category.fixture.fairnessGate.failing.*` | Family of fixtures, one per gate criterion, each violating exactly one rule (answer count low/high, top score low, findable count low, no findable zero, low spread, par = 0) |
| `answerList.corpus.sample` | Small deterministic sample corpus (GloVe rank + SCOWL tier pairs) covering common, obscure-findable, and obscure-unfindable words |
| `wordFixture.common` | `{ word: "the", rank: 1, tier: 10 }` — high panelScore fixture |
| `wordFixture.obscureFindable` | `{ word: "ugh", rank: 4200, tier: 45 }` — zero-scorer but tier ≤ 50 (findable) |
| `wordFixture.obscureUnfindable` | `{ word: "usquebaugh", rank: null (out of GloVe), tier: 70 }` — zero-scorer, unfindable |
| `roundState.completed.win` | Fully completed RoundState with `totalScore < parValue`, both sweep answers populated |
| `roundState.completed.tie` | Completed RoundState with `totalScore == parValue` for boundary-loss test |
| `roundState.pending` | In-progress RoundState with `verdict = "pending"`, used for Share-guard tests |
| `shareInput.daily.win` | `{ totalScore: 42, parValue: 50, verdict: "win", mode: "daily" }` |
| `shareInput.practice.win` | `{ totalScore: 30, parValue: 40, verdict: "win", mode: "practice" }` |
| `contentPack.fixture.valid` | Small valid Content Pack JSON (≤ 5 categories) for accessor/integration tests |
| `contentPack.fixture.emptyCategories` | Content Pack passing integrity schema check but with `categories: []` |
| `contentPack.fixture.missingCategory` | Content Pack lacking an entry for a specifically requested `categoryId` |
| `buildEnv.fixture.missingGlove` | Filesystem mock/test dir with GloVe file path absent |
| `buildEnv.fixture.missingScowl` | Filesystem mock/test dir with SCOWL corpus path absent |
| `hubRegistry.fixture.withLowball` | Hub registry manifest fixture including the Lowball `GameManifest` entry |
| `axeConfig.wcagAA` | axe-core configuration scoped to WCAG 2.1 AA ruleset for automated a11y scans |

## Coverage Matrix

| REQ ID | Unit | Integration | E2E | Security | A11y | Perf | Regression |
|---|---|---|---|---|---|---|---|
| REQ-001 (Daily hash determinism) | ✅ | – | ✅ (journey) | ✅ (no-I/O) | – | – | ✅ (cross-platform) |
| REQ-002 (No same-day reassignment) | – | ✅ | ✅ (journey) | ✅ (unwanted) | – | – | – |
| REQ-003 (UTC rollover reset) | – | ✅ | ✅ (journey) | – | – | – | – |
| REQ-004 (Answer validation) | ✅ | – | – | ✅ (unwanted) | – | – | – |
| REQ-005 (Total score & verdict) | ✅ | – | ✅ (journey) | – | – | – | ✅ |
