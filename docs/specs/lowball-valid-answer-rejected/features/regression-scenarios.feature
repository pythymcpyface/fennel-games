# Test Plan

## Feature Files

```gherkin
# file: profanity_collateral_filtering.feature
Feature: Profanity blocklist must not exclude innocent words via substring match
  As a Content Builder
  I want the generator to stop matching blocklist terms as unanchored substrings
  So that innocent words like "grape" are not wrongly excluded from answer lists

  Background:
    Given the Build-Time Generator is executing the profanity-filter pass
    And the canonical Profanity Matching Strategy Module is loaded with its versioned denylist/allowlist fixtures

  @REQ-001 @AC-TEST-001 @unit @regression
  Scenario: "grape" is not excluded by unanchored substring match against "rape"
    Given the corpus contains the word "grape"
    And the Profanity Blocklist contains the term "rape"
    When the generator filters the "ape"-suffix category
    Then "grape" is present in the category's answerList

  @REQ-001 @AC-TEST-002 @unit @regression
  Scenario Outline: "cock"-collateral words are not excluded by unanchored substring match
    Given the corpus contains the word "<word>"
    And the Profanity Blocklist contains the term "cock"
    When the generator filters the relevant category for "<word>"
    Then "<word>" is present in the category's answerList

    Examples:
      | word        |
      | shuttlecock |
      | peacock     |

  @REQ-001 @AC-TEST-003 @unit @regression
  Scenario Outline: All "ape"-substring collateral words survive profanity filtering
    Given the corpus contains "<word>"
    And the Profanity Blocklist contains the term "rape"
    When the generator filters the word against the "ape" suffix category
    Then "<word>" is present in the category's answerList

    Examples:
      | word      |
      | serape    |
      | undrape   |
      | broomrape |
      | drape     |
      | scrape    |
      | crape     |

  @REQ-001 @AC-TEST-003 @security @regression
  Scenario: Deterministic matching strategy produces identical results across repeated runs
    Given the corpus and blocklist are held fixed
    When the generator is run twice independently against the same inputs
    Then the resulting answerList for every category is byte-for-byte identical between runs
```

```gherkin
# file: genuine_profanity_exclusion.feature
Feature: Genuine profanity must still be excluded from answers and prompts
  As a Content Safety stakeholder
  I want genuinely offensive words blocked from answers and category prompts
  So that the shipped family game contains no offensive content

  Background:
    Given the canonical Profanity Matching Strategy Module isBlocked predicate is loaded
    And the matchingStrategyVersion is recorded for audit

  @REQ-002 @AC-TEST-004 @unit @security @regression
  Scenario: Standalone genuinely offensive word is excluded from every category's answers
    Given the corpus contains the standalone blocked term "rape"
    When the generator filters any category referencing that word
    Then "rape" is absent from every category's answerList

  @REQ-002 @AC-TEST-005 @unit @security @regression
  Scenario Outline: Known inflected forms of blocked terms are excluded from answers
    Given the corpus contains the inflected form "<word>"
    And "<word>" is enumerated in the matching strategy's denylist
    When the generator filters any category referencing that word
    Then "<word>" is absent from every category's answerList

    Examples:
      | word |
      # populated from the versioned denylist fixture at implementation time

  @REQ-002 @AC-TEST-006 @unit @security @regression
  Scenario Outline: Known offensive compound forms are excluded from answers
    Given the corpus contains the compound form "<word>"
    And "<word>" is enumerated in the matching strategy's denylist as an offensive compound
    When the generator filters any category referencing that word
    Then "<word>" is absent from every category's answerList

    Examples:
      | word |
      # populated from the versioned denylist fixture at implementation time

  @REQ-001 @REQ-002 @combined @security @regression
  Scenario: Collateral allowlist and genuine profanity denylist are proven together in one fixture run
    Given the versioned collateral-word allowlist fixture
    And the versioned genuine-profanity denylist fixture
    When the generator runs the profanity-filter pass against both fixtures under the current matchingStrategyVersion
    Then every allowlisted collateral word is present in its category's answerList
    And every denylisted genuine-profanity word is absent from every category's answerList

  @REQ-003 @AC-TEST-007 @unit @security @regression
  Scenario: Category prompt is never emitted when its affix value is itself a blocked term
    Given a candidate affix value that is itself a blocked term under the matching strategy
    When the generator builds the category list
    Then no categoryPrompt using that affix value is emitted

  @REQ-003 @AC-TEST-008 @integration @security @regression
  Scenario: Zero blocked-term matches across all shipped category prompts
    Given the full set of 120+ shipped categoryPrompts from the regenerated pack
    When each categoryPrompt is scanned against the REQ-002 matching strategy
    Then zero matches are found

  @REQ-002 @REQ-003 @security @e2e @regression
  Scenario: CI profanity regression gate blocks release on any genuine profanity in answers or prompts
    Given the regenerated Content Pack
    When the CI Pipeline runs the profanity regression step (JOURNEY-003 Step 4)
    Then known collateral words are confirmed present
    And known genuine profanity is confirmed absent from all answers and all prompts
    And a violation of either condition fails the release gate
```

```gherkin
# file: affix_length_rule_agreement.feature
Feature: Build-time affix grouping must match the runtime matchesAffix rule exactly
  As a Content Builder
  I want the generator to use the identical length comparison as runtime matchesAffix
  So that no valid word is silently excluded by a stricter build-time rule

  Background:
    Given the canonical matchesAffix predicate is imported directly from src/games/lowball/types.ts
    And the Build-Time Generator does not apply any additional length-offset constant

  @REQ-004 @AC-TEST-009 @unit @regression
  Scenario Outline: Words exactly one letter longer than a 3-letter affix are grouped correctly ("ape")
    Given the affixValue "ape"
    And the corpus contains the word "<word>" of length 4
    When the generator groups the "ape" category
    Then "<word>" is present in the category's answerList

    Examples:
      | word |
      | cape |
      | tape |
      | gape |
      | nape |
      | jape |
      | vape |

  @REQ-004 @AC-TEST-010 @unit @regression
  Scenario Outline: Words exactly one letter longer than a 3-letter affix are grouped correctly ("ame")
    Given the affixValue "ame"
    And the corpus contains the word "<word>" of length 4
    When the generator groups the "ame" category
    Then "<word>" is present in the category's answerList

    Examples:
      | word |
      | came |
      | dame |
      | fame |
      | game |
      | lame |
      | name |
      | same |
      | tame |

  @REQ-004 @AC-TEST-011 @unit @regression
  Scenario Outline: Words exactly one letter longer than a 4-letter affix are grouped correctly ("ough")
    Given the affixValue "ough"
    And the corpus contains the word "<word>" of length 5
    When the generator groups the "ough" category
    Then "<word>" is present in the category's answerList

    Examples:
      | word  |
      | bough |
      | cough |
      | dough |
      | rough |
      | tough |

  @REQ-004 @unit @edge
  Scenario: Word length equal to affix length is never grouped into that category
    Given the affixValue "ape"
    And a hypothetical corpus word of length 3 identical in length to the affix
    When the generator evaluates grouping for that word
    Then the word is not included in the "ape" category answerList

  @REQ-004 @unit @edge
  Scenario: Single-character affix boundary behaves identically to matchesAffix
    Given the affixValue is a single character "s"
    And the corpus contains 2-letter and 3-letter candidate words
    When the generator groups the "s" category
    Then only words with length strictly greater than 1 are included
    And the result is identical to invoking matchesAffix directly on each word
```

```gherkin
# file: build_runtime_agreement_proof.feature
Feature: Build-time and runtime acceptance rules must be provably identical
  As a CI Pipeline
  I want to verify soundness and completeness of every category's answerList
  So that build-time/runtime divergence is structurally impossible

  Background:
    Given the CI Pipeline has loaded the regenerated Content Pack
    And the CI Pipeline imports the canonical matchesAffix implementation directly (ADR-003)

  @REQ-006 @AC-TEST-013 @integration @regression
  Scenario: Soundness check fails and names the offending category and word
    Given an answerList artificially seeded with one word that fails matchesAffix for its category's affixValue
    When CI runs the soundness check
    Then CI fails the release gate
    And the failure record names that category and word

  @REQ-006 @AC-TEST-014 @integration @regression
  Scenario: Soundness check passes with zero violations on the real regenerated pack
    Given the real regenerated pack post-fix
    When CI runs the soundness check
    Then CI reports zero violations across all categories

  @REQ-007 @AC-TEST-015 @integration @regression
  Scenario: Completeness check confirms all clean corpus words present for "ape" category
    Given the real regenerated pack
    And the versioned 184-word regression fixture
    When CI runs the completeness check for the "ape" category
    Then grape, drape, scrape, crape, serape, undrape, broomrape, cape, tape, gape, nape, jape, vape are all present in the answerList

  @REQ-007 @AC-TEST-016 @integration @regression
  Scenario: Completeness check confirms all clean corpus words present for "ame" category
    Given the real regenerated pack
    And the versioned 184-word regression fixture
    When CI runs the completeness check for the "ame" category
    Then came, dame, fame, game, lame, name, same, tame are all present in the answerList

  @REQ-007 @AC-TEST-017 @integration @regression
  Scenario: Completeness check confirms all clean corpus words present for "ough" category
    Given the real regenerated pack
    And the versioned 184-word regression fixture
    When CI runs the completeness check for the "ough" category
    Then bough, cough, dough, rough, tough are all present in the answerList

  @REQ-007 @integration @regression
  Scenario: Completeness check fails and names category and missing word when a clean word is omitted
    Given a corpus word that is profanity-clean and satisfies matchesAffix for its category
    And that word is artificially absent from the category's answerList (test fixture)
    When CI runs the completeness check
    Then CI fails the release gate
    And the failure record names that category and the missing word

  @REQ-006 @REQ-007 @edge @integration
  Scenario: A single category failing multiple agreement-proof checks reports all applicable failures
    Given a category artificially seeded with both a soundness violation and a completeness violation
    When CI runs the agreement proof
    Then CI reports both the soundness failure and the completeness failure for that category
    And CI does not halt after the first failure found

  @REQ-005 @non-normative @regression
  Scenario: Legacy combined agreement-proof reference check (superseded by REQ-006/REQ-007)
    Given the full regenerated Content Pack
    When CI runs the agreement proof
    Then zero soundness failures are reported
    # Note: this scenario is retained for traceability only; REQ-006/REQ-007 scenarios are authoritative.
```

```gherkin
# file: reported_bug_regression.feature
Feature: The exact reported bug is fixed - "grape" scores its panel value
  As a Player
  I want "grape" to score correctly in the "ape" category
  So that I am not wrongly penalised for a correct answer

  @REQ-008 @AC-TEST-018 @e2e @regression
  Scenario: Player submits "grape" in the "ape" category on the regenerated pack and receives its panel score
    Given the Content Pack in use is the regenerated post-fix pack
    And the round for category 'Words ending in "ape"' is active
    When the Player submits "grape" as submittedWord
    Then the displayed score equals grape's panelScore in the answerList
    And the UI does not display "Not in the answer list — scored 100."

  @REQ-008 @unwanted @e2e @regression
  Scenario: "grape" is never scored using the invalid-submission penalty
    Given the Content Pack in use is the regenerated post-fix pack
    And the round for category 'Words ending in "ape"' is active
    When the Player submits "grape" as submittedWord
    Then the score shown should NOT equal the invalidSubmissionPenalty value of 100

  @REQ-008 @perf @e2e
  Scenario: Submission lookup for "grape" completes within perceived-synchronous budget
    Given the Content Pack in use is the regenerated post-fix pack
    When the Player submits "grape" as submittedWord
    Then the evaluateSubmission response is returned in under 16ms on reference client hardware
```

```gherkin
# file: fairness_gate_revalidation.feature
Feature: Every regenerated category must satisfy the six-rule fairness gate
  As a CI Pipeline
  I want to re-validate fairness for every category after regeneration
  So that restoring 184 words does not silently break difficulty balance

  Background:
    Given the pack has been regenerated per REQ-001 through REQ-004
    And the six Fairness Gate rules are: answer count 10-36, top score >= 45, at least six findable answers,
      at least one findable zero-scoring answer, at least five non-zero answers spanning at least four distinct
      score values, and a par value above zero

  @REQ-009 @integration @regression
  Scenario Outline: Category passes all six fairness rules post-regeneration
    Given category "<category>" has been regenerated with restored words
    When CI evaluates the Fairness Gate for "<category>"
    Then all six fairness rules pass
    And the category is included in the released pack

    Examples:
      | category            |
      | Words ending in "ape" |
      | Words ending in "ame" |
      | Words ending in "ough" |

  @REQ-009 @integration @regression
  Scenario: Category failing any one fairness rule is excluded and the failure is named
    Given a category's regenerated answerList violates exactly one of the six fairness rules (test fixture)
    When CI evaluates the Fairness Gate for that category
    Then CI fails the release gate
    And the failure record names the category and the specific violated rule

  @REQ-009 @edge @integration
  Scenario: Newly-restored common four-letter words change difficulty profile without breaking the gate
    Given category "Words ending in \"ame\"" now includes came, dame, fame, game, lame, name, same, tame
    When CI evaluates the Fairness Gate for that category
    Then the category still satisfies at least six findable answers
    And the category still satisfies at least one findable zero-scoring answer
    And the category still satisfies at least five non-zero answers spanning at least four distinct score values

  @REQ-009 @edge @integration
  Scenario: Par value remains strictly greater than zero after recomputation
    Given a category's answerList has been recomputed post-regeneration
    When CI computes parValue as the median panelScore of findable answers
    Then parValue is strictly greater than zero
    And parValue is an integer per the documented tie-breaking/rounding rule

  @REQ-009 @edge @integration
  Scenario: Median tie-break on an even-count answer list produces a deterministic integer par value
    Given a category's findable-answer count is even
    When CI computes parValue as the median panelScore
    Then the documented tie-breaking rule (e.g. round down from the average of the two middle values) is applied
    And the result is deterministic and reproducible across repeated computation

  @REQ-009 @BRANCH-002 @integration
  Scenario: Category count floor is evaluated only after per-category exclusions are finalized
    Given a build run where one or more categories are pending Fairness Gate exclusion
    When the categoryCount >= 120 check is evaluated
    Then the check runs after all category exclusions (BRANCH-003) are finalized
    And no excluded category is counted toward the floor

  @REQ-009 @size @integration
  Scenario: Content Pack remains within size ceiling after word restoration
    Given the regenerated pack includes all 184 restored words across affected categories
    When CI evaluates contentPackSizeBytes
    Then contentPackSizeBytes is less than or equal to 204800
```

```gherkin
# file: content_pack_versioning_and_isolation.feature
Feature: Content pack version bump policy and Zone1/Zone2 leak prevention
  As a Content Builder / CI Pipeline
  I want version bumps to reflect content changes and sensitive files to never leak to clients
  So that daily selection stays deterministic and no oversized/sensitive assets ship

  @ADR-004 @integration @regression
  Scenario: Content pack version is bumped when semantic content changes
    Given a regeneration that changes answerList, panelScore, or parValue content versus the previous pack
    When the Content Builder finalizes the build (JOURNEY-002 Step 5)
    Then contentPackVersion is bumped
    And CI verifies the bump occurred

  @ADR-004 @edge @integration
  Scenario: Content pack version is not bumped for a bitwise-identical regeneration
    Given a regeneration that produces an answerList, panelScore, and parValue set identical to the previous pack
    When the Content Builder finalizes the build
    Then contentPackVersion is not bumped
    And CI verifies no bump occurred

  @ADR-004 @edge @e2e
  Scenario: Player mid-round on the old pack version is unaffected by a new release
    Given a Player has an active round loaded on contentPackVersion N
    When a new pack version N+1 is released mid-round
    Then the Player's round continues to use contentPackVersion N until round completion

  @security @ERROR-003 @unit @regression
  Scenario: Build fails fast if any output path could route the GloVe file into a client-bound artifact
    Given the generator's output path configuration
    When the generator evaluates whether GloVe vector file content could reach client-bound output
    Then the build fails immediately with ERROR-003
    And no partial artifact is produced

  @security @unit @regression
  Scenario: No corpus or GloVe content byte-overlap exists in the shipped pack
    Given the final regenerated Content Pack artifact
    When CI computes content-signature overlap between the pack and the raw Corpus/GloVe files
    Then zero overlapping content signatures are found beyond the legitimate answerList word set
```

## Step Definitions

| Step Pattern | Type | Notes |
|---|---|---|
| `Given the corpus contains the word "<word>"` | Given | Loads word into in-memory test corpus fixture |
| `Given the Profanity Blocklist contains the term "<term>"` | Given | Injects blocklist term into test fixture instance |
| `Given "<word>" is enumerated in the matching strategy's denylist` | Given | Asserts fixture membership prior to test execution |
| `Given the affixValue "<affix>"` | Given | Sets candidate affix under test |
| `Given the real regenerated pack post-fix` / `Given the regenerated Content Pack` | Given | Loads full built artifact from build output path |
| `Given the Content Pack in use is the regenerated post-fix pack` | Given | Sets active pack for runtime/e2e harness |
| `Given the round for category '<category>' is active` | Given | Initializes Round state machine at `sweepsRemaining=2` |
| `Given an answerList artificially seeded with <condition>` | Given | Injects test-only mutation into loaded pack copy |
| `When the generator filters the "<affix>"-suffix category` | When | Invokes generator's profanity + grouping pass for one category |
| `When the generator filters any category referencing that word` | When | Runs full profanity pass scoped to word under test |
| `When the generator builds the category list` | When | Invokes full category/prompt construction step |
| `When the generator groups the "<affix>" category` | When | Invokes affix-grouping pass in isolation |
| `When the Player submits "<word>" as submittedWord` | When | Drives UI/`evaluateSubmission` call in e2e harness |
| `When CI runs the soundness check` | When | Invokes CI agreement-proof soundness module |
| `When CI runs the completeness check for the "<category>" category` | When | Invokes CI agreement-proof completeness module scoped to category |
| `When CI evaluates the Fairness Gate for "<category>"` | When | Invokes six-rule fairness evaluator |
| `When CI computes parValue as the median panelScore of findable answers` | When | Invokes par computation module |
| `When CI evaluates contentPackSizeBytes` | When | Reads artifact size in bytes |
| `When the Content Builder finalizes the build` | When | Invokes version-bump decision logic |
| `Then "<word>" is present in the category's answerList` | Then | Asserts membership |
| `Then "<word>" is absent from every category's answerList` | Then | Asserts non-membership across all categories |
| `Then CI fails the release gate` | Then | Asserts CI job exit status is failure |
| `Then the failure record names that category and word` | Then | Asserts structured failure payload fields |
| `Then all six fairness rules pass` | Then | Asserts composite boolean across six sub-checks |
| `Then the displayed score equals grape's panelScore in the answerList` | Then | Asserts UI-rendered score matches pack data |
| `Then the score shown should NOT equal the invalidSubmissionPenalty value of 100` | Then | Negative assertion, unwanted-behaviour pattern |
| `Then contentPackSizeBytes is less than or equal to 204800` | Then | Numeric boundary assertion |
| `Then contentPackVersion is bumped` / `is not bumped` | Then | Asserts version field diff vs. previous manifest |
| `Then the Player's round continues to use contentPackVersion N` | Then | Asserts round-state pin across pack update event |
| `Then the build fails immediately with ERROR-003` | Then | Asserts build process error code/message |
| `Then zero overlapping content signatures are found` | Then | Asserts hash/signature diff result set is empty |

## Test Fixtures

| Fixture Name | Contents | Used By |
|---|---|---|
| `collateral-allowlist.fixture.json` | Full enumerated list of known-safe words wrongly blocked by substring matching (grape, drape, scrape, crape, serape, undrape, broomrape, shuttlecock, peacock, etc.) | profanity_collateral_filtering.feature, genuine_profanity_exclusion.feature (combined scenario) |
| `genuine-profanity-denylist.fixture.json` | Versioned enumerated list of standalone, inflected, and compound genuinely offensive terms (per ADR-002), tagged with `matchingStrategyVersion` | genuine_profanity_exclusion.feature |
| `184-word-regression.fixture.json` | Permanent versioned list of all 184 words wrongly excluded by CAUSE A + CAUSE B, keyed by category (ape, ame, ough, ikes, etc.) per ADR-005 | build_runtime_agreement_proof.feature |
| `affix-boundary.fixture.json` | Synthetic word/affix pairs at exact length boundaries (length == affix length, length == affix length + 1, 1-character affix cases) | affix_length_rule_agreement.feature |
| `sample-corpus-en-gb.fixture.txt` | Reduced representative subset of the 111,676-word corpus for fast unit-level generator tests | affix_length_rule_agreement.feature, profanity_collateral_filtering.feature |
| `blocklist-source.fixture.txt` | Minimal blocklist term set including "rape" and "cock" for isolated CAUSE A regression tests | profanity_collateral_filtering.feature |
| `seeded-unsound-pack.fixture.json` | Content Pack copy with one artificially injected soundness violation (word failing matchesAffix) | build_runtime_agreement_proof.feature |
| `seeded-incomplete-pack.fixture.json` | Content Pack copy with one artificially removed, otherwise-eligible clean word | build_runtime_agreement_proof.feature |
| `seeded-multi-failure-category.fixture.json` | Single category rigged to simultaneously fail soundness, completeness, and fairness | build_runtime_agreement_proof.feature (multi-gate scenario) |
| `fairness-violation-single-rule.fixture.json` | Category answerList violating exactly one of the six fairness rules at a time (six variants) | fairness_gate_revalidation.feature |
| `even-count-answerlist.fixture.json` | Category with an even number of findable answers to exercise median tie-break logic | fairness_gate_revalidation.feature |
| `pre-fix-pack-manifest.json` / `post-fix-pack-manifest.json` | Two full manifest snapshots for version-bump diff testing | content_pack_versioning_and_isolation.feature |
| `identical-regeneration-pair.fixture.json` | Two build outputs with byte-identical semantic content (answerList/panelScore/parValue) but different build timestamps | content_pack_versioning_and_isolation.feature (no-bump scenario) |
| `glove-and-corpus-signature.fixture.json` | Precomputed content signatures/checksums of the GloVe file and raw corpus for negative-overlap assertion | content_pack_versioning_and_isolation.feature |
| `mid-round-player-state.fixture.json` | Simulated Round state pinned to contentPackVersion N, used to test EDGE-004 pinning | content_pack_versioning_and_isolation.feature |

## Coverage Matrix

| Requirement | Unit | Integration | E2E | Security | Perf | A11y | Regression |
|---|---|---|---|---|---|---|---|
| REQ-001 | ✅ TEST-001/002/003 | — | — | ✅ determinism scenario | — | — | ✅ |
| REQ-002 | ✅ TEST-004/005/006 | — | — | ✅ | — | — | ✅ |
| REQ-003 | ✅ TEST-007 | ✅ TEST-008 | — | ✅ | — | — | ✅ |
| REQ-001+REQ-002 (combined) | — | — | — | ✅ combined fixture scenario | — | — | ✅ |
| REQ-004 | ✅ TEST-009/010/011 + boundary edges | — | — | — | — | — | ✅ |
| REQ-005 (superseded) | — | ✅ legacy reference scenario (non-normative) | — | — | — | — | ✅ |
| REQ-006 | — | ✅ TEST-013/014 + multi-failure | — | — | — | — | ✅ |
| REQ-007 | — | ✅ TEST-015/016/017 + missing-word case | — | — | — | — | ✅ |
| REQ-008 | — | — | ✅ TEST-018 + unwanted-behaviour scenario | — | ✅ 16ms budget | — | ✅ |
| REQ-009 | — | ✅ six-rule, par median, category-count ordering | — | — | — | — | ✅ |
| ADR-003 (agreement proof coupling) | — | ✅ covered via REQ-006/007 scenarios | — | — | — | — | ✅ |
| ADR-004 (version bump policy) | — | ✅ bump/no-bump scenarios | ✅ mid-round pinning | — | — | — | ✅ |
| ERROR-003 (GloVe/Corpus leak) | ✅ fail-fast scenario | ✅ signature-overlap scenario | — | ✅ | — | — | ✅ |
| Missing edge case: median tie-break | — | ✅ even-count scenario | — | — | — | — | ✅ |
| Missing edge case: multi-gate simultaneous failure | — | ✅ multi-failure scenario | — | — | — | — | ✅ |
| Missing edge case: count-floor vs. exclusion ordering | — | ✅ BRANCH-002 ordering scenario | — | — | — | — | ✅ |

**Notes on residual gaps not covered by this plan (flagged for follow-up, not blocking):**
- OQ-001 (exact denylist/compound enumeration) is represented structurally via fixture-driven Scenario Outlines with placeholder `Examples` tables — actual rows must be populated only after content-safety sign-off (RISK-001); this plan cannot pre-empt that governance step.
- EDGE-002 (case-sensitivity of submission lookup) is out of scope for this plan per RISK-006 — recommend a dedicated feature file once resolved as a formal REQ.
