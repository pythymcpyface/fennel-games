# Test Plan

## Feature Files

```gherkin
# file: selection_and_dayid.feature
@regression
Feature: Deterministic dayId derivation and daily puzzle selection
  The game must derive a canonical dayId and deterministically map (dayId, packVersion, dictionaryId) to a puzzleId cross-platform.

  @REQ-001 @AC-TEST-001 @unit @regression
  Scenario: Derive canonical dayId from a fixed timestamp using the configured boundary rule
    Given the day-boundary rule is "UTC"
    And the platform clock returns timestamp "1711929600000"
    When the system derives the canonical dayId
    Then the derived dayId equals "2024-04-01"

  @REQ-001 @AC-TEST-002 @integration @regression
  Scenario: Derive identical dayId across platforms for the same timestamp
    Given the day-boundary rule is "UTC"
    And the platform clock returns timestamp "1711929600000" on "pwa"
    And the platform clock returns timestamp "1711929600000" on "ios"
    And the platform clock returns timestamp "1711929600000" on "android"
    When each platform derives the canonical dayId
    Then each platform derived dayId equals "2024-04-01"

  @REQ-002 @AC-TEST-003 @unit @regression
  Scenario: Compute identical puzzleId across platforms for identical selection inputs
    Given dayId is "2024-04-01"
    And contentPackVersion is "1.0.0"
    And dictionaryId is "core.en.v1"
    When the system computes the puzzleId using the seedable hash
    Then the computed puzzleId equals the known puzzleId for these inputs

  @REQ-002 @AC-TEST-004 @unit @regression
  Scenario: Changing dayId changes the selected puzzle or follows the documented collision strategy
    Given contentPackVersion is "1.0.0"
    And dictionaryId is "core.en.v1"
    And dayId is "2024-04-01"
    When the system computes the puzzleId using the seedable hash
    Then the computed puzzleId is recorded as "puzzleIdA"
    When dayId is changed to "2024-04-02" and the system computes the puzzleId using the seedable hash
    Then the computed puzzleId is not equal to "puzzleIdA" or a collision strategy is applied as documented
```

```gherkin
# file: content_pack_loading_and_integrity.feature
@regression
Feature: Content pack loading and integrity verification
  The app must load required puzzle assets from the bundled content pack and block play if required assets are missing or corrupted.

  @REQ-003 @AC-TEST-005 @integration @regression
  Scenario: Load puzzle assets for a valid puzzleId
    Given a bundled content pack with version "1.0.0" and dictionaryId "core.en.v1"
    And puzzleId "puz-0001" exists in the content pack
    When the system loads puzzle assets for puzzleId "puz-0001"
    Then startWord is non-null and exists in the dictionary
    And targetWord is non-null and exists in the dictionary
    And parGuesses is non-null and is an integer greater than or equal to 1
    And a per-target rank table is available for the targetWord

  @REQ-003 @AC-TEST-006 @integration @regression
  Scenario: Block play when the rank table asset is missing
    Given a bundled content pack where puzzleId "puz-missing-rank" has no rank table asset
    When the system loads puzzle assets for puzzleId "puz-missing-rank"
    Then the UI shows a blocked state for error code "ERROR-001"
    And gameplay actions are disabled

  @REQ-004 @AC-TEST-007 @integration @security @regression
  Scenario: Fail integrity validation for corrupted asset bytes and block gameplay
    Given a bundled content pack asset "ranktable:puz-0001" with expected integrity hash "EXPECTED_HASH"
    And the loaded asset bytes for "ranktable:puz-0001" are corrupted
    When the system validates the loaded asset against the expected integrity hash
    Then integrity validation fails
    And the UI shows a blocked state for "content integrity mismatch"

  @REQ-004 @AC-TEST-008 @integration @security @regression
  Scenario: Pass integrity validation for intact asset bytes
    Given a bundled content pack asset "ranktable:puz-0001" with expected integrity hash "EXPECTED_HASH"
    And the loaded asset bytes for "ranktable:puz-0001" are intact
    When the system validates the loaded asset against the expected integrity hash
    Then integrity validation passes
```

```gherkin
# file: game_state_init_and_persistence.feature
@regression
Feature: Game state initialization and local persistence
  The game must initialize state when absent and persist/restore it per (dayId, puzzleId) without network dependency.

  @REQ-005 @AC-TEST-009 @e2e @regression
  Scenario: Initialize state when no saved record exists
    Given no saved game state exists for dayId "2024-04-01" and puzzleId "puz-0001"
    And the puzzle assets are loaded for dayId "2024-04-01" and puzzleId "puz-0001"
    When the player opens the puzzle
    Then puzzleStatus equals "not_started"
    And guessHistory length equals 0
    And bestRank equals vocabSize
    And the UI shows the startWord and "0 guesses"

  @REQ-005 @AC-TEST-010 @integration @regression
  Scenario: Start in-memory state when storage read fails and signal non-persistence
    Given the puzzle assets are loaded for dayId "2024-04-01" and puzzleId "puz-0001"
    And the storage adapter fails to read the game state key for dayId "2024-04-01" and puzzleId "puz-0001"
    When the player opens the puzzle
    Then the system initializes an in-memory game state
    And the UI indicates that progress may not be saved

  @REQ-017 @AC-TEST-029 @e2e @regression
  Scenario: Restore guessHistory after app restart for the same dayId and puzzleId
    Given a saved game state exists for dayId "2024-04-01" and puzzleId "puz-0001" with at least 2 guesses
    When the app restarts
    And the player opens dayId "2024-04-01"
    Then the UI displays the restored guessHistory for puzzleId "puz-0001"
    And the restored guessHistory length equals the saved length
```

```gherkin
# file: guessing_validation_ranking_and_verdict.feature
@regression
Feature: Guess submission validation, rank lookup, verdict computation, and guess history
  The game must validate guesses offline, rank them via the per-target rank table, compute warmer/colder against best-so-far, and append accepted guesses sequentially.

  @REQ-006 @AC-TEST-011 @e2e @regression
  Scenario: Reject non-dictionary words without changing guessHistory
    Given the puzzle is loaded for dayId "2024-04-01"
    And the guessHistory is empty
    When the player submits guessWord "qwertyuiop"
    Then the UI shows "Not in dictionary"
    And guessHistory length remains 0

  @REQ-006 @AC-TEST-012 @e2e @regression
  Scenario: Accept dictionary words during validation
    Given the puzzle is loaded for dayId "2024-04-01"
    And the dictionary contains the word "ocean"
    When the player submits guessWord "ocean"
    Then the guess passes dictionary validation

  @REQ-007 @AC-TEST-013 @e2e @regression
  Scenario: Reject duplicate guesses without appending to history
    Given the puzzle is loaded for dayId "2024-04-01"
    And guessHistory contains the guessWord "ocean"
    When the player submits guessWord "ocean"
    Then the UI shows "Already guessed"
    And guessHistory length remains 1

  @REQ-008 @AC-TEST-014 @integration @regression
  Scenario: Lookup semanticRank and rankTier deterministically from the per-target rank table
    Given the puzzle is loaded for dayId "2024-04-01"
    And the per-target rank table is loaded for the current targetWord
    And the dictionary contains the word "ocean"
    And the rank table contains the word "ocean"
    When the player submits guessWord "ocean"
    Then the system returns a deterministic semanticRank for "ocean"
    And the system returns a deterministic rankTier for "ocean"
    And no floating-point similarity computation is performed at runtime

  @REQ-008 @AC-TEST-015 @integration @regression
  Scenario: Block acceptance when a dictionary word is missing from the rank table
    Given the puzzle is loaded for dayId "2024-04-01"
    And the dictionary contains the word "ocean"
    And the per-target rank table does not contain the word "ocean"
    When the player submits guessWord "ocean"
    Then the UI shows a blocked state for error code "ERROR-002"
    And guessHistory is not appended

  @REQ-009 @AC-TEST-016 @unit @regression
  Scenario: Compute warmer verdict when semanticRank improves bestRank and update bestRank
    Given prior bestRank is 5000
    When semanticRank 3000 is evaluated against the prior bestRank
    Then verdict equals "warmer" or "best" per the verdict enum policy
    And next bestRank equals 3000

  @REQ-009 @AC-TEST-017 @unit @regression
  Scenario: Compute colder verdict when semanticRank is worse than bestRank and do not update bestRank
    Given prior bestRank is 3000
    When semanticRank 4000 is evaluated against the prior bestRank
    Then verdict equals "colder"
    And next bestRank equals 3000

  @REQ-010 @AC-TEST-018 @integration @regression
  Scenario: Append accepted guesses with sequential guessIndex values
    Given the puzzle is loaded for dayId "2024-04-01"
    And the per-target rank table is loaded for the current targetWord
    And the dictionary contains the words "ocean" and "river"
    When the player submits guessWord "ocean"
    And the player submits guessWord "river"
    Then guessHistory contains 2 records
    And the first record guessIndex equals 1
    And the second record guessIndex equals 2

  @REQ-010 @AC-TEST-019 @integration @regression
  Scenario: Degrade gracefully when storage write fails while appending a guess
    Given the puzzle is loaded for dayId "2024-04-01"
    And the storage adapter fails on write
    And the dictionary contains the word "ocean"
    When the player submits guessWord "ocean"
    Then the UI shows "Could not save progress"
    And the in-memory guessHistory contains the new guess record

  @REQ-011 @AC-TEST-020 @unit @regression
  Scenario: Mark isWin true when the normalized guess equals the targetWord
    Given targetWord is "ocean"
    When the player submits guessWord "ocean"
    Then isWin equals true

  @REQ-011 @AC-TEST-021 @unit @regression
  Scenario: Mark isWin false when the normalized guess differs from the targetWord
    Given targetWord is "ocean"
    When the player submits guessWord "river"
    Then isWin equals false

  @REQ-012 @AC-TEST-022 @integration @regression
  Scenario: Transition puzzleStatus to won upon a winning guess
    Given the puzzle is loaded for dayId "2024-04-01"
    And targetWord is "ocean"
    When the player submits guessWord "ocean"
    Then puzzleStatus equals "won"
    And puzzleStatus does not transition away from "won" thereafter
```

```gherkin
# file: hints.feature
@regression
Feature: Hint selection
  Hints must deterministically return a strictly better-ranked word than current bestRank and avoid words already guessed.

  @REQ-013 @AC-TEST-023 @integration @regression
  Scenario: Return a non-null hintWord with semanticRank strictly better than bestRank
    Given the puzzle is loaded for dayId "2024-04-01"
    And bestRank is 5000
    And the per-target rank table is loaded for the current targetWord
    And guessHistory contains no improving candidate words
    When the player requests a hint
    Then hintWord is not null
    And the semanticRank of hintWord is less than 5000

  @REQ-013 @AC-TEST-024 @integration @regression
  Scenario: Return null hintWord when bestRank is already 1
    Given the puzzle is loaded for dayId "2024-04-01"
    And bestRank is 1
    When the player requests a hint
    Then hintWord is null
    And the UI shows "No hint available"

  @REQ-014 @AC-TEST-025 @integration @regression
  Scenario: Do not return a hintWord that is already in guessHistory
    Given the puzzle is loaded for dayId "2024-04-01"
    And bestRank is 5000
    And guessHistory contains the word "ocean"
    And the per-target rank table would otherwise select "ocean" as an improving hint
    When the player requests a hint
    Then hintWord is not equal to "ocean"
    And hintWord is not present in guessHistory
```

```gherkin
# file: share_artifact_and_spoiler_safety.feature
@regression
Feature: Share artifact generation and spoiler safety
  Share text must be deterministic, spoiler-safe, and work via platform share or clipboard fallback.

  @REQ-015 @AC-TEST-026 @e2e @regression
  Scenario: ShareText for a won puzzle ends with a star marker
    Given the puzzle is loaded for dayId "2024-04-01"
    And the puzzleStatus is "won"
    And guessHistory has at least 1 guess including the winning guess
    When the player requests share
    Then shareText is generated
    And shareText ends with a star marker

  @REQ-015 @AC-TEST-027 @e2e @regression
  Scenario: ShareText for an in-progress puzzle contains no win marker
    Given the puzzle is loaded for dayId "2024-04-01"
    And the puzzleStatus is "in_progress"
    And guessHistory has at least 1 guess
    When the player requests share
    Then shareText is generated
    And shareText does not contain a win marker

  @REQ-016 @AC-TEST-028 @security @integration @regression
  Scenario: Block share when shareText contains the targetWord substring
    Given targetWord is "ocean"
    And shareText is "I solved it: ocean"
    When the system checks shareText for spoiler safety
    Then the share action is blocked
    And the user is informed that sharing was blocked to prevent spoilers
```

```gherkin
# file: stats_and_streaks.feature
@regression
Feature: Local-only stats updates
  Stats must update deterministically and idempotently per dayId using local persistence only.

  @REQ-018 @AC-TEST-030 @integration @regression
  Scenario: Increment gamesPlayed once on the first transition to in_progress for a given dayId
    Given stats show gamesPlayed equals 10
    And the puzzle for dayId "2024-04-01" has not yet been started in stats markers
    When the first accepted guess is recorded for dayId "2024-04-01"
    Then gamesPlayed equals 11
    When a second accepted guess is recorded for dayId "2024-04-01"
    Then gamesPlayed remains 11

  @REQ-019 @AC-TEST-031 @integration @regression
  Scenario: Increment gamesWon once on the first transition to won for a given dayId even after restart
    Given stats show gamesWon equals 5
    And the puzzle for dayId "2024-04-01" is not yet marked won in stats markers
    When the puzzleStatus transitions to "won" for dayId "2024-04-01"
    Then gamesWon equals 6
    When the app restarts and dayId "2024-04-01" is loaded again
    And the puzzleStatus is still "won" for dayId "2024-04-01"
    Then gamesWon remains 6
```

```gherkin
# file: accessibility.feature
@regression
Feature: Accessibility support
  Core gameplay must be keyboard operable, screen reader perceivable, and respect reduced motion.

  @REQ-020 @AC-TEST-032 @e2e @a11y @regression
  Scenario: Submit guess using keyboard Enter key from the guess input
    Given the puzzle page is open
    And keyboard focus is on the guess input
    When the player presses "Enter"
    Then the app triggers the Submit Guess action

  @REQ-020 @AC-TEST-033 @e2e @a11y @regression
  Scenario: Request hint using keyboard Space or Enter on the Hint button
    Given the puzzle page is open
    And keyboard focus is on the Hint button
    When the player presses "Space"
    Then the app triggers the Request Hint action

  @REQ-020 @AC-TEST-034 @e2e @a11y @regression
  Scenario: Request share using keyboard Space or Enter on the Share button
    Given the puzzle page is open
    And keyboard focus is on the Share button
    When the player presses "Enter"
    Then the app triggers the Share action

  @NFR-003 @AC-TEST-037 @e2e @a11y @regression
  Scenario: Announce verdict and tier via aria-live when announcements are enabled
    Given the puzzle is loaded
    And a11yAnnouncementsEnabled is true
    When the player submits an accepted guess resulting in verdict "warmer" and tier label "Tier 2"
    Then an aria-live region announces text containing "Warmer"
    And the aria-live region announces text containing "Tier 2"
    And the announcement contains no targetWord

  @NFR-004 @AC-TEST-038 @e2e @a11y @regression
  Scenario: Disable non-essential animations when reduced motion is enabled
    Given the puzzle is loaded
    And reducedMotionEnabled is true
    When the verdict feedback UI updates after an accepted guess
    Then no non-essential animation longer than 100ms occurs in the verdict/tier feedback component
```

```gherkin
# file: offline_privacy_and_determinism_nfrs.feature
@regression
Feature: Offline-first, privacy, and cross-platform determinism NFRs
  Gameplay must work in airplane mode, produce identical outputs cross-platform, and avoid outbound telemetry.

  @NFR-001 @AC-TEST-035 @e2e @regression
  Scenario: Complete gameplay offline without network dependency
    Given the device network is disabled
    And the app is installed with a bundled content pack
    When the player opens today's puzzle
    And the player submits dictionary-valid guesses until the puzzle is won
    And the player generates shareText
    Then puzzle selection, dictionary validation, rank lookup, verdict computation, win detection, and shareText generation all succeed without network access

  @NFR-002 @AC-TEST-036 @integration @regression
  Scenario: Emit identical verdict and tier sequences across platforms for the same pack and guess list
    Given contentPackVersion is "1.0.0" and dictionaryId is "core.en.v1"
    And dayId is "2024-04-01"
    And the guess list is:
      | guessWord |
      | ocean     |
      | river     |
      | cloud     |
    When the guess list is replayed on "pwa"
    And the guess list is replayed on "ios"
    And the guess list is replayed on "android"
    Then the verdict sequence matches exactly across "pwa", "ios", and "android"
    And the rankTier sequence matches exactly across "pwa", "ios", and "android"

  @NFR-005 @AC-TEST-039 @e2e @security @regression
  Scenario: Make no outbound network requests during gameplay and stats viewing
    Given network inspection is enabled
    When the player opens today's puzzle and submits 3 valid guesses
    And the player opens the stats screen
    Then the app runtime makes zero outbound network requests excluding OS-level connectivity checks outside the app
```

```gherkin
# file: local_diagnostics_optional.feature
@regression
Feature: Local diagnostics (optional)
  If enabled, diagnostics must aid troubleshooting without revealing the target word.

  @NFR-006 @AC-TEST-040 @e2e @regression
  Scenario: Show metadata fields and exclude the target word on diagnostics screen when enabled
    Given the diagnostics feature is enabled
    And the puzzle is loaded for dayId "2024-04-01"
    When the player opens the diagnostics screen
    Then the UI displays contentPackVersion
    And the UI displays dictionaryId
    And the UI displays puzzleId
    And the UI displays dayId
    And the UI does not display the targetWord
```

## Step Definitions

| Step (Reusable) | Type | Notes / Parameters |
|---|---|---|
| Given the day-boundary rule is {string} | Given | e.g., `"UTC"`; injected into core canonicalization |
| Given the platform clock returns timestamp {string} | Given | ms since epoch as string to avoid JS int issues |
| Given the platform clock returns timestamp {string} on {string} | Given | platform in `{pwa|ios|android}` |
| When the system derives the canonical dayId | When | calls core canonicalize function |
| When each platform derives the canonical dayId | When | run canonicalize for each platform harness |
| Then the derived dayId equals {string} | Then | strict equality |
| Given dayId is {string} | Given | ISO `YYYY-MM-DD` |
| Given contentPackVersion is {string} | Given | semver-like |
| Given dictionaryId is {string} | Given | token |
| When the system computes the puzzleId using the seedable hash | When | core derivePuzzleId |
| Then the computed puzzleId equals the known puzzleId for these inputs | Then | golden vector assertion |
| Given a bundled content pack with version {string} and dictionaryId {string} | Given | fixture pack loader |
| Given puzzleId {string} exists in the content pack | Given | ensures mapping present |
| When the system loads puzzle assets for puzzleId {string} | When | via content pack module + adapter |
| Then startWord is non-null and exists in the dictionary | Then | dictionary membership |
| Then targetWord is non-null and exists in the dictionary | Then | dictionary membership |
| Then parGuesses is non-null and is an integer greater than or equal to 1 | Then | numeric validation |
| Then a per-target rank table is available for the targetWord | Then | rank table handle exists |
| Given a bundled content pack where puzzleId {string} has no rank table asset | Given | missing asset fixture |
| Then the UI shows a blocked state for error code {string} | Then | error UI model check |
| And gameplay actions are disabled | Then | submit/hint/share disabled |
| Given a bundled content pack asset {string} with expected integrity hash {string} | Given | manifest fixture |
| Given the loaded asset bytes for {string} are corrupted | Given | mutate bytes |
| Given the loaded asset bytes for {string} are intact | Given | pristine bytes |
| When the system validates the loaded asset against the expected integrity hash | When | core verifyAssetHash |
| Then integrity validation fails | Then | boolean false |
| Then integrity validation passes | Then | boolean true |
| Given no saved game state exists for dayId {string} and puzzleId {string} | Given | storage cleared |
| Given the puzzle assets are loaded for dayId {string} and puzzleId {string} | Given | controller load precondition |
| When the player opens the puzzle | When | controller loadPuzzle |
| Then puzzleStatus equals {string} | Then | state assertion |
| And guessHistory length equals {int} | Then | |
| And bestRank equals vocabSize | Then | requires fixture vocabSize |
| And the UI shows the startWord and {string} | Then | view model assertion |
| Given the storage adapter fails to read the game state key for dayId {string} and puzzleId {string} | Given | adapter stub throws |
| Then the system initializes an in-memory game state | Then | controller flag |
| And the UI indicates that progress may not be saved | Then | warning shown |
| Given a saved game state exists for dayId {string} and puzzleId {string} with at least {int} guesses | Given | storage seeded |
| When the app restarts | When | new controller instance |
| Then the UI displays the restored guessHistory for puzzleId {string} | Then | |
| Given the puzzle is loaded for dayId {string} | Given | loadPuzzle(dayId) |
| Given the guessHistory is empty | Given | state seed |
| When the player submits guessWord {string} | When | submitGuess |
| Then the UI shows {string} | Then | validation messaging |
| And guessHistory length remains {int} | Then | |
| Given the dictionary contains the word {string} | Given | dictionary fixture |
| Then the guess passes dictionary validation | Then | internal validation result |
| Given guessHistory contains the guessWord {string} | Given | |
| Given the per-target rank table is loaded for the current targetWord | Given | |
| Given the rank table contains the word {string} | Given | |
| Then the system returns a deterministic semanticRank for {string} | Then | stable integer |
| Then the system returns a deterministic rankTier for {string} | Then | stable int tier |
| And no floating-point similarity computation is performed at runtime | Then | assert no FP path invoked (spy) |
| Given the per-target rank table does not contain the word {string} | Given | mismatch fixture |
| And guessHistory is not appended | Then | |
| Given prior bestRank is {int} | Given | unit core |
| When semanticRank {int} is evaluated against the prior bestRank | When | core verdict fn |
| Then verdict equals {string} or {string} per the verdict enum policy | Then | allow policy variants |
| And next bestRank equals {int} | Then | |
| Given the storage adapter fails on write | Given | adapter stub throws |
| Then the UI shows {string} | Then | toast/banner |
| And the in-memory guessHistory contains the new guess record | Then | |
| Given targetWord is {string} | Given | test-only exposure |
| Then isWin equals {bool} | Then | |
| And puzzleStatus does not transition away from {string} thereafter | Then | attempt subsequent transitions |
| Given bestRank is {int} | Given | |
| When the player requests a hint | When | requestHint |
| Then hintWord is not null | Then | |
| Then hintWord is null | Then | |
| And the semanticRank of hintWord is less than {int} | Then | lookup in table |
| And the UI shows {string} | Then | |
| Given the per-target rank table would otherwise select {string} as an improving hint | Given | deterministic hint fixture |
| Then hintWord is not equal to {string} | Then | |
| And hintWord is not present in guessHistory | Then | |
| Given the puzzleStatus is {string} | Given | |
| When the player requests share | When | controller share |
| Then shareText is generated | Then | non-empty |
| And shareText ends with a star marker | Then | suffix check |
| And shareText does not contain a win marker | Then | pattern check |
| Given shareText is {string} | Given | |
| When the system checks shareText for spoiler safety | When | core isSpoilerSafe |
| Then the share action is blocked | Then | blocked signal |
| And the user is informed that sharing was blocked to prevent spoilers | Then | message shown |
| Given stats show gamesPlayed equals {int} | Given | stats fixture |
| Given the puzzle for dayId {string} has not yet been started in stats markers | Given | marker seed |
| When the first accepted guess is recorded for dayId {string} | When | simulate transition |
| Then gamesPlayed equals {int} | Then | |
| Then gamesPlayed remains {int} | Then | |
| Given stats show gamesWon equals {int} | Given | |
| Given the puzzle for dayId {string} is not yet marked won in stats markers | Given | |
| When the puzzleStatus transitions to {string} for dayId {string} | When | apply win |
| Then gamesWon equals {int} | Then | |
| Then gamesWon remains {int} | Then | |
| Given the puzzle page is open | Given | UI navigated |
| And keyboard focus is on the {string} | Given | "guess input" / "Hint button" / "Share button" |
| When the player presses {string} | When | key event |
| Then the app triggers the {string} action | Then | action spy |
| Given a11yAnnouncementsEnabled is true | Given | setting |
| When the player submits an accepted guess resulting in verdict {string} and tier label {string} | When | fixture to force output |
| Then an aria-live region announces text containing {string} | Then | DOM assertion |
| And the announcement contains no targetWord | Then | |
| Given reducedMotionEnabled is true | Given | |
| Then no non-essential animation longer than {int}ms occurs in the verdict/tier feedback component | Then | animation timing hook |
| Given the device network is disabled | Given | airplane-mode harness |
| Given network inspection is enabled | Given | e2e harness |
| Then the app runtime makes zero outbound network requests excluding OS-level connectivity checks outside the app | Then | network log assertion |
| Given the diagnostics feature is enabled | Given | build flag |
| When the player opens the diagnostics screen | When | route/action |
| Then the UI displays {string} | Then | fields list |
| And the UI does not display the targetWord | Then | negative assertion |

## Test Fixtures

| Fixture Name | Description | Used By |
|---|---|---|
| FIX-PACK-VALID-1 | Minimal valid content pack with metadata (packVersion, dictionaryId, integrity hash/manifest), one puzzleId mapping, dictionary, rank table | REQ-003/004/006/008 baseline |
| FIX-PACK-MISSING-RANK | Content pack where puzzle mapping exists but rank table asset ref is missing | REQ-003 TEST-006 |
| FIX-ASSET-CORRUPTED | Byte-mutated asset blob for integrity failure | REQ-004 TEST-007 |
| FIX-ASSET-INTACT | Exact bytes matching expected hash | REQ-004 TEST-008 |
| FIX-DICT-SMALL | Small dictionary containing {ocean, river, cloud, ...} with stable tokenization | REQ-006/007 |
| FIX-RANKTABLE-COVERAGE-OK | Rank table containing all FIX-DICT-SMALL words with deterministic ranks/tiers | REQ-008/009 |
| FIX-RANKTABLE-COVERAGE-MISSING | Rank table missing one dictionary word to trigger ERROR-002 | REQ-008 TEST-015 |
| FIX-STATE-NONE | Storage cleared/no record for (dayId,puzzleId) | REQ-005 TEST-009 |
| FIX-STATE-SAVED-2GUESSES | Persisted state containing 2 valid guess records for restore tests | REQ-017 TEST-029 |
| FIX-STATS-BASE | Stats with gamesPlayed=10 gamesWon=5 and empty per-day markers | REQ-018/019 |
| FIX-A11Y-ON | Settings with a11yAnnouncementsEnabled=true | NFR-003 |
| FIX-REDUCED-MOTION-ON | Settings/system pref reducedMotionEnabled=true | NFR-004 |
| FIX-NETWORK-OFF | Harness configuration disabling network | NFR-001 |
| FIX-NETWORK-INSPECT | Harness that records all runtime outbound requests | NFR-005 |
| FIX-GOLDEN-VECTORS | Golden inputs/outputs for dayId→puzzleId and guess→(rank,tier,verdict) | REQ-001/002, NFR-002 |

## Coverage Matrix

| Requirement | unit | integration | e2e | security | perf | a11y | regression |
|---|---:|---:|---:|---:|---:|---:|---:|
| REQ-001 | X | X |  |  |  |  | X |
| REQ-002 | X |  |  |  |  |  | X |
| REQ-003 |  | X |  |  |  |  | X |
| REQ-004 |  | X |  | X |  |  | X |
| REQ-005 |  | X | X |  |  |  | X |
| REQ-006 |  |  | X |  |  |  | X |
| REQ-007 |  |  | X |  |  |  | X |
| REQ-008 |  | X |  |  |  |  | X |
| REQ-009 | X |  |  |  |  |  | X |
| REQ-010 |  | X |  |  |  |  | X |
| REQ-011 | X |  |  |  |  |  | X |
| REQ-012 |  | X |  |  |  |  | X |
| REQ-013 |  | X |  |  |  |  | X |
| REQ-014 |  | X |  |  |  |  | X |
| REQ-015 |  |  | X |  |  |  | X |
| REQ-016 |  | X |  | X |  |  | X |
| REQ-017 |  |  | X |  |  |  | X |
| REQ-018 |  | X |  |  |  |  | X |
| REQ-019 |  | X |  |  |  |  | X |
| REQ-020 |  |  | X |  |  | X | X |
| NFR-001 |  |  | X |  |  |  | X |
| NFR-002 |  | X |  |  |  |  | X |
| NFR-003 |  |  | X |  |  | X | X |
| NFR-004 |  |  | X |  |  | X | X |
| NFR-005 |  |  | X | X |  |  | X |
| NFR-006 |  |  | X |  |  |  | X |
