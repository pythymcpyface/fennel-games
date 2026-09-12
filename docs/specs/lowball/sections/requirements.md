# Requirements

> **Provenance.** REQ-001..REQ-003 are as emitted by the AAS supervisor (Phase 1).
> REQ-004..REQ-048 were authored by the local Phase-3 atomicity loop to close
> **RISK-003** (the supervisor's Requirements section was truncated mid-REQ-004) and to
> resolve the Proposed ADRs (ADR-006, ADR-007, ADR-008) plus RISK-001, RISK-004,
> RISK-007, RISK-008, RISK-010, RISK-011, RISK-012 into numbered, testable form.
> Every REQ below is atomic per A1–A8, lint-clean per V1–V10, and schema-complete per S1–S6.

---

### REQ-001: Deterministic Daily category selection via FNV-1a hash
- **ID:** REQ-001
- **Title:** Compute Daily Round categoryId deterministically
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When the Player opens the Daily Round entry point, the Lowball engine shall compute `categoryId` by applying FNV-1a 32-bit hash to the Dataset Seed composed of `dayId`, `contentPackVersion`, and `datasetId`.
- **Inputs:** FIELD-001 dayId, FIELD-002 contentPackVersion, FIELD-003 datasetId
- **Outputs:** FIELD-004 categoryId
- **Preconditions:** Content Pack installed and precached; UTC clock available to Hub Shell (not the engine).
- **Postconditions:** `categoryId` is stable for identical (dayId, contentPackVersion, datasetId) tuples.
- **Invariants:** Engine performs no I/O; hash function is pure.
- **Trigger:** Player opens ENTRY-001.
- **Actor:** System (Engine)
- **EntityScope:** Daily Round (TERM-001)
- **ErrorModes:** ERROR-005 (Content Pack missing category data)
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-001 step 2
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-001: Given identical dayId, contentPackVersion and datasetId, when the seed is hashed twice, then categoryId is byte-identical both times.
  - TEST-002: Given a frozen contentPackVersion and a historical dayId, when hashed under iOS WKWebView, Android WebView and desktop Chromium, then categoryId is identical under all three runtimes.
- **Assumptions:** UTC day boundary computation is performed by Hub Shell, not the engine.
- **OpenQuestions:** none

---

### REQ-002: Reject Daily Round replay within the same UTC day
- **ID:** REQ-002
- **Title:** Prevent same-day Daily Round restart with a new category
- **EARS Pattern:** Unwanted
- **EARS Statement:** The Lowball engine shall not reassign `categoryId` for the Daily Round while the Save State `dayId` equals the current UTC `dayId`.
- **Inputs:** FIELD-001 dayId (saved), FIELD-001 dayId (current)
- **Outputs:** unchanged FIELD-004 categoryId
- **Preconditions:** Daily Save State exists for the current dayId.
- **Postconditions:** categoryId remains the value originally assigned for that dayId.
- **Invariants:** One categoryId per dayId per contentPackVersion.
- **Trigger:** Player reopens the Daily Round entry point on the same UTC day.
- **Actor:** System (Engine)
- **EntityScope:** Daily Round
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-001 LOOP-002
- **Dependencies:** REQ-001
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-003: Given a Daily Save State carrying today's dayId and categoryId X, when the Player reopens the Daily Round, then categoryId remains X.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-003: Reset Daily Round on UTC day rollover
- **ID:** REQ-003
- **Title:** Start a fresh Daily Round when saved dayId is stale
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When the Hub Shell loads a Daily Save State whose `dayId` differs from the current UTC `dayId`, the Lowball engine shall initialise a fresh Daily Round state for the current `dayId`.
- **Inputs:** FIELD-001 dayId (saved), FIELD-001 dayId (current)
- **Outputs:** new FIELD-004 categoryId, FIELD-014 sweepIndex=0, FIELD-018 verdict="pending"
- **Preconditions:** Daily Save State exists and is stale.
- **Postconditions:** The stale pending round is discarded and contributes nothing to the Stats Record.
- **Invariants:** Stats Record is written only for rounds completed under their own dayId.
- **Trigger:** Load event on ENTRY-001 with dayId mismatch.
- **Actor:** System (Engine)
- **EntityScope:** Daily Round
- **ErrorModes:** none
- **NFR-Tags:** NFR-005
- **Source:** JOURNEY-001 EDGE-005
- **Dependencies:** REQ-001
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-004: Given a saved dayId of the prior day with sweepIndex=1 and verdict="pending", when the state is loaded today, then a fresh round is initialised with sweepIndex=0.
  - TEST-005: Given the same stale pending round, when the state is loaded today, then the Stats Record played count is unchanged.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-004: Constrain category selection to the admitted category set
- **ID:** REQ-004
- **Title:** Map the selection hash only into admitted categories
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Lowball engine shall map the FNV-1a selection hash modulo the count of categories admitted to the installed Content Pack.
- **Inputs:** FNV-1a hash value, admitted category count
- **Outputs:** FIELD-004 categoryId within the admitted set
- **Preconditions:** Content Pack declares its admitted category count.
- **Postconditions:** The selected categoryId resolves to a category present in the pack.
- **Invariants:** No selection resolves outside the admitted index range.
- **Trigger:** Category selection is performed.
- **Actor:** System (Engine)
- **EntityScope:** Affix Category (TERM-003)
- **ErrorModes:** ERROR-005
- **NFR-Tags:** NFR-004
- **Source:** RISK-007
- **Dependencies:** REQ-001
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-006: Given 3650 consecutive dayId values, when each is mapped to a categoryId, then every resulting categoryId exists in the admitted category set.
  - TEST-007: Given a Content Pack declaring a category count of zero, when selection is attempted, then the engine returns a PackUnavailable result rather than throwing.
- **Assumptions:** Admitted category count is a positive integer for shipped packs.
- **OpenQuestions:** none

---

### REQ-005: Normalise a submitted answer before lookup
- **ID:** REQ-005
- **Title:** Normalise submission casing, whitespace and diacritics
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When the Player submits an Answer, the Lowball engine shall normalise the raw string to NFC form, trim surrounding whitespace, lowercase it, and strip characters outside a–z before any lookup.
- **Inputs:** raw submission string
- **Outputs:** normalised FIELD-008 answerWord
- **Preconditions:** A Sweep is active.
- **Postconditions:** The normalised form is the only value compared against the Answer List.
- **Invariants:** Normalisation is idempotent.
- **Trigger:** Answer submission.
- **Actor:** System (Engine)
- **EntityScope:** Answer (TERM-005)
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-001 step 6
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-008: Given the raw submission "  ThOuGh  ", when normalised, then the result equals "though".
  - TEST-009: Given a normalised string, when normalisation is applied a second time, then the result is unchanged.
- **Assumptions:** Answer Lists store words already in normalised form.
- **OpenQuestions:** none

---

### REQ-006: Score an answer absent from the Answer List as the maximum penalty
- **ID:** REQ-006
- **Title:** Penalise an answer outside the Answer List
- **EARS Pattern:** Unwanted
- **EARS Statement:** If a normalised Answer is absent from the round's Answer List, then the Lowball engine shall assign that Sweep a `panelScore` of 100.
- **Inputs:** normalised FIELD-008 answerWord, TERM-009 Answer List
- **Outputs:** FIELD-009 panelScore = 100
- **Preconditions:** A Sweep is active.
- **Postconditions:** The Sweep is consumed and marked invalid.
- **Invariants:** No exception propagates to the View.
- **Trigger:** Answer submission absent from the Answer List.
- **Actor:** System (Engine)
- **EntityScope:** Answer
- **ErrorModes:** ERROR-001
- **NFR-Tags:** NFR-005
- **Source:** JOURNEY-001 ERROR-001
- **Dependencies:** REQ-005
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-010: Given the submission "zzzzqqq" for a category whose Answer List omits it, when submitted, then panelScore for that Sweep equals 100.
  - TEST-011: Given the same submission, when submitted, then the engine returns a state object without throwing.
- **Assumptions:** Answer List completeness is guaranteed by the Build Tool.
- **OpenQuestions:** none

---

### REQ-007: Score an answer failing the affix pattern as the maximum penalty
- **ID:** REQ-007
- **Title:** Penalise an answer that does not fit the affix
- **EARS Pattern:** Unwanted
- **EARS Statement:** If a normalised Answer does not match the round's `affixType` and `affixValue`, then the Lowball engine shall assign that Sweep a `panelScore` of 100.
- **Inputs:** normalised FIELD-008 answerWord, FIELD-006 affixType, FIELD-007 affixValue
- **Outputs:** FIELD-009 panelScore = 100
- **Preconditions:** A Sweep is active.
- **Postconditions:** The Sweep is consumed and marked invalid.
- **Invariants:** Affix matching is a pure string operation.
- **Trigger:** Answer submission failing the affix test.
- **Actor:** System (Engine)
- **EntityScope:** Answer
- **ErrorModes:** ERROR-002
- **NFR-Tags:** NFR-005
- **Source:** JOURNEY-001 ERROR-002
- **Dependencies:** REQ-005
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-012: Given the category suffix "ugh" and the real word "table", when "table" is submitted, then panelScore for that Sweep equals 100.
  - TEST-013: Given the category prefix "pre" and the submission "postpone", when submitted, then panelScore for that Sweep equals 100.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-008: Score a repeated answer as the maximum penalty
- **ID:** REQ-008
- **Title:** Penalise a duplicate of the player's earlier answer
- **EARS Pattern:** Unwanted
- **EARS Statement:** If the normalised Answer submitted in Sweep 1 equals the normalised Answer the same player submitted in Sweep 0, then the Lowball engine shall assign Sweep 1 a `panelScore` of 100.
- **Inputs:** normalised Sweep 0 answerWord, normalised Sweep 1 answerWord
- **Outputs:** FIELD-024 isDuplicateOfEarlierAnswer = true, FIELD-009 panelScore = 100
- **Preconditions:** Sweep 0 is complete for that player.
- **Postconditions:** Sweep 1 is consumed and marked duplicate.
- **Invariants:** Duplication is evaluated per player, not across players.
- **Trigger:** Sweep 1 submission equal to the Sweep 0 answer.
- **Actor:** System (Engine)
- **EntityScope:** Answer
- **ErrorModes:** ERROR-003
- **NFR-Tags:** NFR-005
- **Source:** JOURNEY-001 ERROR-003
- **Dependencies:** REQ-005
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-014: Given "though" submitted in Sweep 0, when "though" is submitted in Sweep 1, then panelScore for Sweep 1 equals 100.
  - TEST-015: Given "though" submitted in Sweep 0, when "THOUGH  " is submitted in Sweep 1, then isDuplicateOfEarlierAnswer is true.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-009: Score an empty submission as the maximum penalty
- **ID:** REQ-009
- **Title:** Penalise an empty or whitespace-only submission
- **EARS Pattern:** Unwanted
- **EARS Statement:** If a submission normalises to an empty string, then the Lowball engine shall assign that Sweep a `panelScore` of 100.
- **Inputs:** raw submission string
- **Outputs:** FIELD-009 panelScore = 100
- **Preconditions:** A Sweep is active.
- **Postconditions:** The Sweep is consumed and marked invalid.
- **Invariants:** The engine defends against empty input independently of View-layer validation.
- **Trigger:** Submission normalising to an empty string.
- **Actor:** System (Engine)
- **EntityScope:** Answer
- **ErrorModes:** EDGE-001
- **NFR-Tags:** NFR-005
- **Source:** JOURNEY-001 EDGE-001
- **Dependencies:** REQ-005
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-016: Given the raw submission "   ", when submitted, then panelScore for that Sweep equals 100.
  - TEST-017: Given the raw submission "123", when submitted, then panelScore for that Sweep equals 100.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-010: Assign the precomputed panel score to a valid answer
- **ID:** REQ-010
- **Title:** Read the panel score from the Answer List
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When a normalised Answer is present in the round's Answer List and matches the affix, the Lowball engine shall assign that Sweep the `panelScore` recorded for that word in the Answer List.
- **Inputs:** normalised FIELD-008 answerWord, TERM-009 Answer List
- **Outputs:** FIELD-009 panelScore
- **Preconditions:** A Sweep is active.
- **Postconditions:** The Sweep records the score verbatim from the pack.
- **Invariants:** The runtime never recomputes a score from a formula.
- **Trigger:** Valid answer submission.
- **Actor:** System (Engine)
- **EntityScope:** Answer
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-001 step 7
- **Dependencies:** REQ-005, REQ-006, REQ-007
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-018: Given an Answer List recording "hiccough" with panelScore 0, when "hiccough" is submitted, then the Sweep panelScore equals 0.
  - TEST-019: Given an Answer List recording "through" with panelScore 100, when "through" is submitted, then the Sweep panelScore equals 100.
- **Assumptions:** Scores are precomputed at build time per ADR-004.
- **OpenQuestions:** none

---

### REQ-011: Advance the sweep index after a consumed sweep
- **ID:** REQ-011
- **Title:** Increment sweepIndex on submission
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When a Sweep is consumed by any submission, the Lowball engine shall increment `sweepIndex` by exactly one.
- **Inputs:** FIELD-014 sweepIndex
- **Outputs:** FIELD-014 sweepIndex incremented
- **Preconditions:** sweepIndex is less than 2.
- **Postconditions:** sweepIndex never exceeds 2.
- **Invariants:** Increment occurs for valid and invalid submissions alike.
- **Trigger:** Sweep consumption.
- **Actor:** System (Engine)
- **EntityScope:** Sweep (TERM-004)
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-001 step 9
- **Dependencies:** REQ-006, REQ-010
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-020: Given sweepIndex 0, when a valid answer is submitted, then sweepIndex equals 1.
  - TEST-021: Given sweepIndex 0, when an invalid answer is submitted, then sweepIndex equals 1.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-012: Refuse submission once the round is terminal
- **ID:** REQ-012
- **Title:** Reject a third submission in a round
- **EARS Pattern:** Unwanted
- **EARS Statement:** If `sweepIndex` has reached 2 for the active player, then the Lowball engine shall return the state unchanged together with a `no_sweeps_remaining` error marker.
- **Inputs:** FIELD-014 sweepIndex, submission string
- **Outputs:** unchanged state, error marker `no_sweeps_remaining`
- **Preconditions:** Both Sweeps are consumed.
- **Postconditions:** No score or verdict field is mutated.
- **Invariants:** The engine returns an error marker rather than throwing.
- **Trigger:** Submission attempted after two consumed Sweeps.
- **Actor:** System (Engine)
- **EntityScope:** Sweep
- **ErrorModes:** `no_sweeps_remaining`
- **NFR-Tags:** NFR-005
- **Source:** Architecture — Error handling strategy
- **Dependencies:** REQ-011
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-022: Given sweepIndex 2, when a further answer is submitted, then the returned state is deep-equal to the prior state.
  - TEST-023: Given sweepIndex 2, when a further answer is submitted, then the returned error marker equals "no_sweeps_remaining".
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-013: Compute the total as the sum of both sweep scores
- **ID:** REQ-013
- **Title:** Sum the two sweep scores into a total
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When both Sweeps for a player are consumed, the Lowball engine shall compute `totalScore` as the arithmetic sum of that player's two `panelScore` values.
- **Inputs:** Sweep 0 panelScore, Sweep 1 panelScore
- **Outputs:** FIELD-017 totalScore
- **Preconditions:** Both Sweeps are consumed.
- **Postconditions:** totalScore equals the sum of the two recorded scores.
- **Invariants:** Integer arithmetic only.
- **Trigger:** Second Sweep consumption.
- **Actor:** System (Engine)
- **EntityScope:** Total Score (TERM-007)
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-001 step 11
- **Dependencies:** REQ-010, REQ-011
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-024: Given sweep scores 12 and 7, when the total is computed, then totalScore equals 19.
  - TEST-025: Given sweep scores 0 and 0, when the total is computed, then totalScore equals 0.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-014: Leave the total uncapped above 100
- **ID:** REQ-014
- **Title:** Permit a total score above 100
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Lowball engine shall record `totalScore` values above 100 without clamping.
- **Inputs:** Sweep 0 panelScore, Sweep 1 panelScore
- **Outputs:** FIELD-017 totalScore
- **Preconditions:** Both Sweeps are consumed.
- **Postconditions:** totalScore may hold any value in 0..200.
- **Invariants:** No upper clamp is applied to totalScore.
- **Trigger:** Total computation where the sum exceeds 100.
- **Actor:** System (Engine)
- **EntityScope:** Total Score
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-001 EDGE-003
- **Dependencies:** REQ-013
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-026: Given sweep scores 60 and 60, when the total is computed, then totalScore equals 120.
  - TEST-027: Given sweep scores 100 and 100, when the total is computed, then totalScore equals 200.
- **Assumptions:** A future multiplayer mode compares totals across players, so totals above 100 remain meaningful.
- **OpenQuestions:** none

---

### REQ-015: Declare a win when the total is strictly below par
- **ID:** REQ-015
- **Title:** Set verdict to win below par
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When both Sweeps are consumed and `totalScore` is strictly less than `parValue`, the Lowball engine shall set `verdict` to "win".
- **Inputs:** FIELD-017 totalScore, FIELD-013 parValue
- **Outputs:** FIELD-018 verdict = "win"
- **Preconditions:** Both Sweeps are consumed.
- **Postconditions:** verdict is terminal for the round.
- **Invariants:** Comparison is strict inequality.
- **Trigger:** Total computation completing.
- **Actor:** System (Engine)
- **EntityScope:** Verdict (TERM-020)
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-001 step 12
- **Dependencies:** REQ-013
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-028: Given totalScore 19 and parValue 21, when the verdict is computed, then verdict equals "win".
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-016: Declare a loss when the total equals or exceeds par
- **ID:** REQ-016
- **Title:** Set verdict to loss at or above par
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When both Sweeps are consumed and `totalScore` is greater than or equal to `parValue`, the Lowball engine shall set `verdict` to "loss".
- **Inputs:** FIELD-017 totalScore, FIELD-013 parValue
- **Outputs:** FIELD-018 verdict = "loss"
- **Preconditions:** Both Sweeps are consumed.
- **Postconditions:** verdict is terminal for the round.
- **Invariants:** Equality to par yields a loss.
- **Trigger:** Total computation completing.
- **Actor:** System (Engine)
- **EntityScope:** Verdict
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-001 step 12, TERM-020 anti-definition
- **Dependencies:** REQ-013
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-029: Given totalScore 21 and parValue 21, when the verdict is computed, then verdict equals "loss".
  - TEST-030: Given totalScore 90 and parValue 21, when the verdict is computed, then verdict equals "loss".
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-017: Hold the verdict pending until both sweeps are consumed
- **ID:** REQ-017
- **Title:** Keep verdict pending mid-round
- **EARS Pattern:** State-Driven
- **EARS Statement:** While `sweepIndex` is less than 2, the Lowball engine shall keep `verdict` set to "pending".
- **Inputs:** FIELD-014 sweepIndex
- **Outputs:** FIELD-018 verdict = "pending"
- **Preconditions:** The round has begun.
- **Postconditions:** No win or loss is recorded before both Sweeps are consumed.
- **Invariants:** verdict transitions out of "pending" exactly once per round.
- **Trigger:** Any state read while sweepIndex is below 2.
- **Actor:** System (Engine)
- **EntityScope:** Verdict
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** TERM-020 anti-definition
- **Dependencies:** REQ-011
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-031: Given a round with sweepIndex 1, when the verdict is read, then verdict equals "pending".
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-018: Initialise the tick counter at 100
- **ID:** REQ-018
- **Title:** Seed the Tension Counter at 100
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When a Sweep score is assigned, the Lowball engine shall set `tickCounter` to 100.
- **Inputs:** FIELD-009 panelScore
- **Outputs:** FIELD-019 tickCounter = 100
- **Preconditions:** A Sweep has been consumed.
- **Postconditions:** The drain sequence starts from 100.
- **Invariants:** tickCounter remains within 0..100.
- **Trigger:** Score assignment.
- **Actor:** System (Engine)
- **EntityScope:** Tick Counter (TERM-015)
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-001 step 4, ADR-001
- **Dependencies:** REQ-010
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-032: Given a Sweep scoring 40, when the score is assigned, then tickCounter equals 100.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-019: Decrement the tick counter by one per advance call
- **ID:** REQ-019
- **Title:** Advance the drain by a single discrete step
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When `advanceTick` is invoked and `tickCounter` exceeds the target `panelScore`, the Lowball engine shall decrement `tickCounter` by exactly one.
- **Inputs:** FIELD-019 tickCounter, FIELD-009 panelScore
- **Outputs:** FIELD-019 tickCounter decremented
- **Preconditions:** tickCounter exceeds panelScore.
- **Postconditions:** tickCounter is monotonically non-increasing within a drain sequence.
- **Invariants:** The engine reads no clock during the advance.
- **Trigger:** `advanceTick` invocation.
- **Actor:** System (Engine)
- **EntityScope:** Tick Counter
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** ADR-001
- **Dependencies:** REQ-018
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-033: Given tickCounter 100 and panelScore 98, when advanceTick is invoked once, then tickCounter equals 99.
  - TEST-034: Given tickCounter 100 and panelScore 0, when advanceTick is invoked 100 times, then tickCounter equals 0.
- **Assumptions:** The View schedules advance calls; the engine holds no timing logic.
- **OpenQuestions:** none

---

### REQ-020: Hold the tick counter at the target score
- **ID:** REQ-020
- **Title:** Make the drain idempotent at its target
- **EARS Pattern:** Unwanted
- **EARS Statement:** If `advanceTick` is invoked while `tickCounter` equals the target `panelScore`, then the Lowball engine shall return `tickCounter` unchanged.
- **Inputs:** FIELD-019 tickCounter, FIELD-009 panelScore
- **Outputs:** unchanged FIELD-019 tickCounter
- **Preconditions:** tickCounter equals panelScore.
- **Postconditions:** tickCounter never falls below panelScore.
- **Invariants:** Over-advancing cannot produce a negative or under-target value.
- **Trigger:** `advanceTick` invocation at the target.
- **Actor:** System (Engine)
- **EntityScope:** Tick Counter
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** ADR-001
- **Dependencies:** REQ-019
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-035: Given tickCounter 12 and panelScore 12, when advanceTick is invoked 20 times, then tickCounter equals 12.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-021: Skip the drain under reduced motion
- **ID:** REQ-021
- **Title:** Set the tick counter directly to the score under reduced motion
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When a Sweep score is assigned and `reducedMotion` is true, the Lowball engine shall set `tickCounter` directly to the target `panelScore`.
- **Inputs:** FIELD-020 reducedMotion, FIELD-009 panelScore
- **Outputs:** FIELD-019 tickCounter = panelScore
- **Preconditions:** A Sweep has been consumed.
- **Postconditions:** No intermediate drain value is observable.
- **Invariants:** The engine treats reducedMotion as read-only input.
- **Trigger:** Score assignment with reducedMotion true.
- **Actor:** System (Engine)
- **EntityScope:** Tick Counter
- **ErrorModes:** none
- **NFR-Tags:** NFR-001
- **Source:** JOURNEY-001 BRANCH-003, TERM-022
- **Dependencies:** REQ-018
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-036: Given reducedMotion true and a Sweep scoring 33, when the score is assigned, then tickCounter equals 33.
  - TEST-037: Given reducedMotion true, when the score is assigned, then tickCounter never holds the value 100 in the returned state.
- **Assumptions:** Hub Shell supplies the `prefers-reduced-motion` value.
- **OpenQuestions:** none

---

### REQ-022: Persist Practice results only under the practice storage key
- **ID:** REQ-022
- **Title:** Confine Practice writes to the practice key
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Hub Shell shall write Practice Round state only under `storageKeyPractice`.
- **Inputs:** Practice round state, FIELD-022 storageKeyPractice
- **Outputs:** persisted Practice Save State
- **Preconditions:** A Practice Round has produced state.
- **Postconditions:** The value under `storageKeyDaily` is unchanged.
- **Invariants:** The two storage keys never hold each other's data.
- **Trigger:** Practice Round state persistence.
- **Actor:** Hub Shell
- **EntityScope:** Practice Round (TERM-002)
- **ErrorModes:** ERROR-006
- **NFR-Tags:** NFR-003
- **Source:** JOURNEY-002 step 6, ADR-003
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-038: Given a Daily Save State snapshot, when a full Practice Round is completed, then the value under storageKeyDaily is byte-identical to the snapshot.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-023: Exclude Practice results from the Stats Record
- **ID:** REQ-023
- **Title:** Leave the Stats Record untouched by Practice
- **EARS Pattern:** Unwanted
- **EARS Statement:** The Hub Shell shall not write the Stats Record during a Practice Round.
- **Inputs:** Practice round verdict, TERM-011 Stats Record
- **Outputs:** unchanged Stats Record
- **Preconditions:** A Practice Round has reached a verdict.
- **Postconditions:** Played count, won count and streak values are unchanged.
- **Invariants:** Stats Record mutation is reachable only from the Daily completion path.
- **Trigger:** Practice Round verdict computation.
- **Actor:** Hub Shell
- **EntityScope:** Stats Record
- **ErrorModes:** ERROR-006
- **NFR-Tags:** NFR-003
- **Source:** JOURNEY-002 step 6
- **Dependencies:** REQ-022
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-039: Given a Stats Record snapshot, when a Practice Round is won, then the Stats Record is byte-identical to the snapshot.
  - TEST-040: Given a Stats Record snapshot, when a Practice Round is lost, then the Stats Record is byte-identical to the snapshot.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-024: Select the Practice category deterministically
- **ID:** REQ-024
- **Title:** Derive the Practice category from a named seed
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When the Player starts a Practice Round, the Lowball engine shall select the category by applying FNV-1a 32-bit hash to the seed formed of `dayId`, the literal "practice", and the practice attempt ordinal.
- **Inputs:** FIELD-001 dayId, practice attempt ordinal
- **Outputs:** FIELD-004 categoryId for the Practice Round
- **Preconditions:** Content Pack contains at least one admitted category.
- **Postconditions:** Identical inputs yield an identical Practice categoryId.
- **Invariants:** No random number source is consulted.
- **Trigger:** Practice Round start.
- **Actor:** System (Engine)
- **EntityScope:** Affix Category
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** RISK-010, JOURNEY-002 step 2
- **Dependencies:** REQ-004
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-041: Given dayId "2026-09-10" and practice ordinal 3, when the Practice category is selected twice, then both selections yield the same categoryId.
  - TEST-042: Given practice ordinals 1 through 20 on one dayId, when each category is selected, then every result exists in the admitted category set.
- **Assumptions:** The practice attempt ordinal is persisted in Practice Save State.
- **OpenQuestions:** none

---

### REQ-025: Exclude today's Daily category from Practice selection
- **ID:** REQ-025
- **Title:** Keep the Practice category distinct from the Daily category
- **EARS Pattern:** Unwanted
- **EARS Statement:** If the deterministically selected Practice category equals today's Daily `categoryId` and the admitted set holds more than one category, then the Lowball engine shall advance to the next admitted category by index.
- **Inputs:** Practice categoryId, Daily categoryId, admitted category count
- **Outputs:** FIELD-004 categoryId distinct from the Daily categoryId
- **Preconditions:** Admitted category count exceeds one.
- **Postconditions:** The Practice category differs from today's Daily category.
- **Invariants:** Advancement remains deterministic.
- **Trigger:** Practice selection colliding with the Daily category.
- **Actor:** System (Engine)
- **EntityScope:** Affix Category
- **ErrorModes:** BRANCH-004
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-002 step 2
- **Dependencies:** REQ-024
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-043: Given a Practice selection colliding with the Daily categoryId, when selection resolves, then the returned categoryId differs from the Daily categoryId.
  - TEST-044: Given a pack holding exactly one admitted category, when a Practice Round starts, then the returned categoryId equals the Daily categoryId.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-026: Retain a single Practice round slot
- **ID:** REQ-026
- **Title:** Overwrite prior Practice state on a new Practice round
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When the Player starts a new Practice Round, the Hub Shell shall overwrite the existing value under `storageKeyPractice`.
- **Inputs:** new Practice round state
- **Outputs:** persisted Practice Save State holding one round
- **Preconditions:** A prior Practice Save State may exist.
- **Postconditions:** Exactly one Practice round is retained.
- **Invariants:** Practice Save State holds no round array.
- **Trigger:** Practice Round start.
- **Actor:** Hub Shell
- **EntityScope:** Practice Round
- **ErrorModes:** none
- **NFR-Tags:** NFR-002
- **Source:** ADR-006 (resolved to Accepted by this REQ), JOURNEY-002 LOOP-003
- **Dependencies:** REQ-022
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-045: Given a completed Practice round in storage, when a new Practice Round starts, then Practice Save State holds only the new round.
- **Assumptions:** Practice history is out of scope for v1.
- **OpenQuestions:** none

---

### REQ-027: Persist save state with a schema version
- **ID:** REQ-027
- **Title:** Stamp persisted state with schemaVersion
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Hub Shell shall include `schemaVersion` in every persisted Lowball Save State record.
- **Inputs:** round state, FIELD-023 schemaVersion
- **Outputs:** persisted record carrying schemaVersion
- **Preconditions:** State persistence is requested.
- **Postconditions:** Every stored record declares its schema version.
- **Invariants:** schemaVersion is a positive integer.
- **Trigger:** State persistence.
- **Actor:** Hub Shell
- **EntityScope:** Save State (TERM-023)
- **ErrorModes:** none
- **NFR-Tags:** NFR-002
- **Source:** FIELD-023
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-046: Given a completed round, when state is persisted, then the stored record contains a positive integer schemaVersion.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-028: Discard unmigratable save state without throwing
- **ID:** REQ-028
- **Title:** Recover from corrupt save state
- **EARS Pattern:** Unwanted
- **EARS Statement:** If a persisted Lowball Save State fails schema validation and migration returns null, then the Hub Shell shall discard the record and return a freshly initialised round.
- **Inputs:** corrupt stored record
- **Outputs:** freshly initialised round state
- **Preconditions:** A stored record exists and fails validation.
- **Postconditions:** No exception reaches the View.
- **Invariants:** Discarding one key leaves the other key untouched.
- **Trigger:** Save State load failing validation.
- **Actor:** Hub Shell
- **EntityScope:** Save State
- **ErrorModes:** ERROR-004, ERROR-007
- **NFR-Tags:** NFR-005
- **Source:** JOURNEY-001 ERROR-004
- **Dependencies:** REQ-027
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-047: Given the stored string "{not json", when the Daily state is loaded, then a fresh round is returned and no exception is raised.
  - TEST-048: Given a corrupt Practice record, when the Practice state is loaded, then the Daily record is unchanged.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-029: Expose a single migration function contract
- **ID:** REQ-029
- **Title:** Define one migration signature for both storage keys
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Hub Shell shall expose Lowball state migration through the single signature `migrate(state, fromVersion, toVersion)` returning either a migrated state or null.
- **Inputs:** stored state, fromVersion, toVersion
- **Outputs:** migrated state or null
- **Preconditions:** A stored record declares a schemaVersion below the current version.
- **Postconditions:** Daily and Practice paths reuse the same migration scaffolding.
- **Invariants:** The migration function performs no storage writes.
- **Trigger:** Save State load with a lower schemaVersion.
- **Actor:** Hub Shell
- **EntityScope:** Save State
- **ErrorModes:** none
- **NFR-Tags:** NFR-002
- **Source:** RISK-011
- **Dependencies:** REQ-027
- **Priority:** SHOULD
- **AcceptanceCriteria:**
  - TEST-049: Given a record at schemaVersion 1 and a current version of 1, when migrate is invoked, then the returned state equals the input state.
  - TEST-050: Given a record at an unknown schemaVersion 99, when migrate is invoked, then the return value is null.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-030: Reconcile a persisted verdict missing from the Stats Record
- **ID:** REQ-030
- **Title:** Retry a missed Stats Record update on next load
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When the Hub Shell loads a Daily Save State holding a terminal verdict whose `dayId` is absent from the Stats Record played days, the Hub Shell shall apply the Stats Record update once for that `dayId`.
- **Inputs:** Daily Save State verdict, FIELD-001 dayId, Stats Record played days
- **Outputs:** updated Stats Record
- **Preconditions:** A prior Stats Record write did not complete.
- **Postconditions:** The Stats Record reflects the persisted verdict exactly once.
- **Invariants:** Reconciliation is idempotent per dayId.
- **Trigger:** Daily Save State load with an unreconciled terminal verdict.
- **Actor:** Hub Shell
- **EntityScope:** Stats Record
- **ErrorModes:** none
- **NFR-Tags:** NFR-002
- **Source:** RISK-008
- **Dependencies:** REQ-027
- **Priority:** SHOULD
- **AcceptanceCriteria:**
  - TEST-051: Given a Daily Save State with verdict "win" and a Stats Record omitting that dayId, when the state is loaded, then the Stats Record records one win for that dayId.
  - TEST-052: Given the same state loaded a second time, when the state is loaded, then the Stats Record win count is unchanged.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-031: Admit only categories holding 10 to 36 valid answers
- **ID:** REQ-031
- **Title:** Gate category admission on answer count
- **EARS Pattern:** Unwanted
- **EARS Statement:** If a candidate Affix Category holds fewer than 10 or more than 36 valid answers, then the Build Tool shall exclude that category from the Content Pack.
- **Inputs:** candidate Answer List length
- **Outputs:** admission decision
- **Preconditions:** Candidate enumeration is complete.
- **Postconditions:** Every admitted category holds 10 to 36 answers inclusive.
- **Invariants:** Bounds are inclusive at both ends.
- **Trigger:** Fairness Gate evaluation.
- **Actor:** Build Tool
- **EntityScope:** Fairness Gate (TERM-013)
- **ErrorModes:** BRANCH-005
- **NFR-Tags:** NFR-006
- **Source:** JOURNEY-003 step 4, EDGE-012
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-053: Given a candidate holding exactly 10 answers, when the gate is applied, then the candidate is admitted.
  - TEST-054: Given a candidate holding 37 answers, when the gate is applied, then the candidate is excluded.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-032: Admit only categories holding a high-scoring trap answer
- **ID:** REQ-032
- **Title:** Gate category admission on top score
- **EARS Pattern:** Unwanted
- **EARS Statement:** If the highest `panelScore` in a candidate Affix Category is below 45, then the Build Tool shall exclude that category from the Content Pack.
- **Inputs:** candidate Answer List panelScore values
- **Outputs:** admission decision
- **Preconditions:** Panel scores are computed for the candidate.
- **Postconditions:** Every admitted category holds at least one answer scoring 45 or above.
- **Invariants:** The threshold is inclusive at 45.
- **Trigger:** Fairness Gate evaluation.
- **Actor:** Build Tool
- **EntityScope:** Fairness Gate
- **ErrorModes:** BRANCH-005
- **NFR-Tags:** NFR-006
- **Source:** JOURNEY-003 step 4, EDGE-013
- **Dependencies:** REQ-036
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-055: Given a candidate whose top score is exactly 45, when the gate is applied, then the candidate is admitted.
  - TEST-056: Given a candidate whose top score is 44, when the gate is applied, then the candidate is excluded.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-033: Admit only categories holding six findable answers
- **ID:** REQ-033
- **Title:** Gate category admission on findable answer count
- **EARS Pattern:** Unwanted
- **EARS Statement:** If a candidate Affix Category holds fewer than 6 answers at SCOWL tier 50 or better, then the Build Tool shall exclude that category from the Content Pack.
- **Inputs:** candidate answers with FIELD-011 scowlTier
- **Outputs:** admission decision
- **Preconditions:** SCOWL tiers are resolved for the candidate.
- **Postconditions:** Every admitted category offers at least 6 retrievable answers.
- **Invariants:** Tier comparison treats lower numbers as more common.
- **Trigger:** Fairness Gate evaluation.
- **Actor:** Build Tool
- **EntityScope:** Fairness Gate
- **ErrorModes:** BRANCH-005
- **NFR-Tags:** NFR-006
- **Source:** JOURNEY-003 step 4
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-057: Given a candidate holding exactly 6 answers at tier 50 or better, when the gate is applied, then the candidate is admitted.
  - TEST-058: Given a candidate holding 5 answers at tier 50 or better, when the gate is applied, then the candidate is excluded.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-034: Admit only categories holding a findable zero-scoring answer
- **ID:** REQ-034
- **Title:** Gate category admission on a findable zero-scorer
- **EARS Pattern:** Unwanted
- **EARS Statement:** If a candidate Affix Category holds no answer whose `panelScore` equals 0 at SCOWL tier 50 or better, then the Build Tool shall exclude that category from the Content Pack.
- **Inputs:** candidate answers with panelScore and scowlTier
- **Outputs:** admission decision
- **Preconditions:** Panel scores and tiers are resolved.
- **Postconditions:** Every admitted category offers at least one retrievable zero-scoring answer.
- **Invariants:** Raw obscurity alone does not satisfy this rule.
- **Trigger:** Fairness Gate evaluation.
- **Actor:** Build Tool
- **EntityScope:** Fairness Gate
- **ErrorModes:** BRANCH-005
- **NFR-Tags:** NFR-006
- **Source:** JOURNEY-003 step 4, TERM-010
- **Dependencies:** REQ-036
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-059: Given a candidate whose only zero-scorers sit at tier 70, when the gate is applied, then the candidate is excluded.
  - TEST-060: Given a candidate holding one zero-scorer at tier 50, when the gate is applied, then the candidate is admitted.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-035: Admit only categories holding a graded scoring ladder
- **ID:** REQ-035
- **Title:** Gate category admission on score spread
- **EARS Pattern:** Unwanted
- **EARS Statement:** If a candidate Affix Category holds fewer than 5 answers scoring above 0, or those answers span fewer than 4 distinct score values, then the Build Tool shall exclude that category from the Content Pack.
- **Inputs:** candidate answers with panelScore
- **Outputs:** admission decision
- **Preconditions:** Panel scores are computed.
- **Postconditions:** Every admitted category presents a graded ladder rather than a cliff.
- **Invariants:** Distinctness is measured across integer score values.
- **Trigger:** Fairness Gate evaluation.
- **Actor:** Build Tool
- **EntityScope:** Fairness Gate
- **ErrorModes:** BRANCH-005
- **NFR-Tags:** NFR-006
- **Source:** JOURNEY-003 step 4
- **Dependencies:** REQ-036
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-061: Given a candidate holding 4 non-zero answers, when the gate is applied, then the candidate is excluded.
  - TEST-062: Given a candidate holding 6 non-zero answers spanning 3 distinct values, when the gate is applied, then the candidate is excluded.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-036: Compute the panel score from GloVe rank
- **ID:** REQ-036
- **Title:** Apply the panel score formula
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When the Build Tool scores an answer present in GloVe vocabulary at SCOWL tier 50 or better, the Build Tool shall compute `panelScore` as 100 multiplied by ((5.2 minus log base 10 of `gloveRank`) divided by 2.2) raised to the power 2.2.
- **Inputs:** FIELD-012 gloveRank, FIELD-011 scowlTier
- **Outputs:** FIELD-009 panelScore
- **Preconditions:** The answer resolves to a GloVe vocabulary line.
- **Postconditions:** The score is a rounded integer.
- **Invariants:** The formula runs at build time only.
- **Trigger:** Answer scoring during content build.
- **Actor:** Build Tool
- **EntityScope:** Panel Score (TERM-006)
- **ErrorModes:** ERROR-010
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-003 step 3
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-063: Given gloveRank 132 at tier 10, when the score is computed, then panelScore equals 100.
  - TEST-064: Given gloveRank 40445 at tier 35, when the score is computed, then panelScore equals 6.
- **Assumptions:** GloVe vocabulary ordering encodes descending corpus frequency.
- **OpenQuestions:** none

---

### REQ-037: Score an out-of-vocabulary answer as zero
- **ID:** REQ-037
- **Title:** Assign zero to an answer absent from GloVe
- **EARS Pattern:** Unwanted
- **EARS Statement:** If an answer is absent from the GloVe vocabulary, then the Build Tool shall assign it a `panelScore` of 0.
- **Inputs:** FIELD-012 gloveRank set to null
- **Outputs:** FIELD-009 panelScore = 0
- **Preconditions:** GloVe lookup has completed.
- **Postconditions:** The answer records a zero score.
- **Invariants:** Out-of-vocabulary status overrides the formula.
- **Trigger:** Answer scoring with a null gloveRank.
- **Actor:** Build Tool
- **EntityScope:** Panel Score
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-003 step 3, EDGE-015
- **Dependencies:** REQ-036
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-065: Given the answer "usquebaugh" absent from GloVe, when the score is computed, then panelScore equals 0.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-038: Score a specialist-tier answer as zero
- **ID:** REQ-038
- **Title:** Assign zero to an answer above SCOWL tier 50
- **EARS Pattern:** Unwanted
- **EARS Statement:** If an answer carries a SCOWL tier above 50, then the Build Tool shall assign it a `panelScore` of 0.
- **Inputs:** FIELD-011 scowlTier
- **Outputs:** FIELD-009 panelScore = 0
- **Preconditions:** The SCOWL tier is resolved.
- **Postconditions:** The answer records a zero score.
- **Invariants:** Tiers above 50 are treated as unknown to a lay panel.
- **Trigger:** Answer scoring with a tier above 50.
- **Actor:** Build Tool
- **EntityScope:** Panel Score
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-003 step 3
- **Dependencies:** REQ-036
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-066: Given the answer "clough" at tier 70 with a resolved GloVe rank, when the score is computed, then panelScore equals 0.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-039: Clamp the computed panel score to 0 through 100
- **ID:** REQ-039
- **Title:** Bound the panel score range
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Build Tool shall clamp every computed `panelScore` into the inclusive range 0 to 100.
- **Inputs:** raw formula output
- **Outputs:** FIELD-009 panelScore within 0..100
- **Preconditions:** The formula has produced a raw value.
- **Postconditions:** No stored score falls outside 0..100.
- **Invariants:** Clamping is applied before rounding is persisted.
- **Trigger:** Panel score computation.
- **Actor:** Build Tool
- **EntityScope:** Panel Score
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-003 EDGE-014
- **Dependencies:** REQ-036
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-067: Given a gloveRank of 1, when the score is computed, then panelScore equals 100.
  - TEST-068: Given a gloveRank near the vocabulary tail, when the score is computed, then panelScore is greater than or equal to 0.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-040: Treat a non-finite formula result as zero
- **ID:** REQ-040
- **Title:** Convert a non-finite score to zero
- **EARS Pattern:** Unwanted
- **EARS Statement:** If the panel score formula yields a non-finite value, then the Build Tool shall record a `panelScore` of 0 and write an entry to the build report.
- **Inputs:** raw formula output
- **Outputs:** FIELD-009 panelScore = 0, build report entry
- **Preconditions:** The formula has produced a non-finite value.
- **Postconditions:** The build continues to completion.
- **Invariants:** A non-finite value never reaches the Content Pack.
- **Trigger:** Formula producing NaN or an infinite value.
- **Actor:** Build Tool
- **EntityScope:** Panel Score
- **ErrorModes:** ERROR-010
- **NFR-Tags:** NFR-005
- **Source:** JOURNEY-003 ERROR-010
- **Dependencies:** REQ-036
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-069: Given a gloveRank of 0 producing a non-finite logarithm, when the score is computed, then panelScore equals 0.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-041: Compute par as the median findable answer score
- **ID:** REQ-041
- **Title:** Derive parValue from findable answers
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When a candidate Affix Category passes the Fairness Gate, the Build Tool shall compute `parValue` as the median `panelScore` of that category's answers at SCOWL tier 50 or better.
- **Inputs:** findable answer panelScore values
- **Outputs:** FIELD-013 parValue
- **Preconditions:** The category has passed all gate rules.
- **Postconditions:** parValue is a non-negative integer.
- **Invariants:** parValue is computed once per category per pack version.
- **Trigger:** Category admission.
- **Actor:** Build Tool
- **EntityScope:** Par (TERM-008)
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** JOURNEY-003 step 5
- **Dependencies:** REQ-033
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-070: Given findable scores 0, 2, 21, 41 and 95, when par is computed, then parValue equals 21.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-042: Exclude categories whose par is zero
- **ID:** REQ-042
- **Title:** Gate category admission on a winnable par
- **EARS Pattern:** Unwanted
- **EARS Statement:** If a candidate Affix Category yields a `parValue` of 0, then the Build Tool shall exclude that category from the Content Pack.
- **Inputs:** FIELD-013 parValue
- **Outputs:** admission decision
- **Preconditions:** parValue has been computed.
- **Postconditions:** Every admitted category is winnable.
- **Invariants:** A total below zero is unreachable, so a zero par is unwinnable.
- **Trigger:** Fairness Gate evaluation after par computation.
- **Actor:** Build Tool
- **EntityScope:** Fairness Gate
- **ErrorModes:** BRANCH-005
- **NFR-Tags:** NFR-006
- **Source:** ADR-007 (resolved to Accepted by this REQ), RISK-001, EDGE-016
- **Dependencies:** REQ-041
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-071: Given a candidate yielding parValue 0, when the gate is applied, then the candidate is excluded.
  - TEST-072: Given a shipped Content Pack, when every admitted category is inspected, then each parValue is greater than 0.
- **Assumptions:** The 1045-candidate pool leaves headroom for this filter.
- **OpenQuestions:** none

---

### REQ-043: Fail the content build when GloVe vectors are missing
- **ID:** REQ-043
- **Title:** Halt the build on an unreadable GloVe file
- **EARS Pattern:** Unwanted
- **EARS Statement:** If the GloVe vector file is absent or unreadable, then the Build Tool shall terminate with a non-zero exit status and a message naming the expected path.
- **Inputs:** GloVe file path
- **Outputs:** non-zero exit status, diagnostic message
- **Preconditions:** A content build has started.
- **Postconditions:** No Content Pack is written.
- **Invariants:** Missing vectors never yield silently empty ranks.
- **Trigger:** GloVe file read failing.
- **Actor:** Build Tool
- **EntityScope:** Content Pack (TERM-012)
- **ErrorModes:** ERROR-008
- **NFR-Tags:** NFR-005
- **Source:** JOURNEY-003 ERROR-008
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-073: Given an absent GloVe path, when the build runs, then the process exits with a non-zero status.
  - TEST-074: Given an absent GloVe path, when the build runs, then the emitted message contains the expected file path.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-044: Exclude derivation source data from the Content Pack
- **ID:** REQ-044
- **Title:** Keep GloVe and SCOWL artefacts out of the shipped pack
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Build Tool shall exclude GloVe vectors and raw SCOWL tier listings from the serialised Content Pack.
- **Inputs:** candidate serialisation payload
- **Outputs:** Content Pack containing categories, answers, scores and par only
- **Preconditions:** Categories have been admitted.
- **Postconditions:** The pack carries no vector data.
- **Invariants:** Derivation inputs stay build-time only.
- **Trigger:** Content Pack serialisation.
- **Actor:** Build Tool
- **EntityScope:** Content Pack
- **ErrorModes:** none
- **NFR-Tags:** NFR-003
- **Source:** ADR-005, JOURNEY-003 step 7
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-075: Given a generated Content Pack, when its keys are enumerated, then no key holds vector arrays.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-045: Fail the content build when the pack exceeds its size ceiling
- **ID:** REQ-045
- **Title:** Enforce a Content Pack size ceiling
- **EARS Pattern:** Unwanted
- **EARS Statement:** If the serialised Content Pack exceeds 200 kibibytes, then the Build Tool shall terminate with a non-zero exit status.
- **Inputs:** serialised pack byte length
- **Outputs:** non-zero exit status
- **Preconditions:** Serialisation has completed.
- **Postconditions:** The shipped pack stays within the precache budget.
- **Invariants:** The ceiling is checked on every build.
- **Trigger:** Serialised size exceeding the ceiling.
- **Actor:** Build Tool
- **EntityScope:** Content Pack
- **ErrorModes:** none
- **NFR-Tags:** NFR-006
- **Source:** RISK-012
- **Dependencies:** REQ-044
- **Priority:** SHOULD
- **AcceptanceCriteria:**
  - TEST-076: Given a serialised pack of 201 kibibytes, when the ceiling is checked, then the build exits with a non-zero status.
  - TEST-077: Given the shipped pack, when its size is measured, then the size is at most 200 kibibytes.
- **Assumptions:** The measured target is approximately 150 kibibytes.
- **OpenQuestions:** none

---

### REQ-046: Fail the content build below the minimum admitted category count
- **ID:** REQ-046
- **Title:** Require at least 120 admitted categories
- **EARS Pattern:** Unwanted
- **EARS Statement:** If fewer than 120 candidate Affix Categories pass the Fairness Gate, then the Build Tool shall terminate with a non-zero exit status.
- **Inputs:** admitted category count
- **Outputs:** non-zero exit status
- **Preconditions:** Gate evaluation has completed for all candidates.
- **Postconditions:** A shipped pack always offers at least 120 distinct days of content.
- **Invariants:** The count is measured after every gate rule.
- **Trigger:** Admitted count below 120.
- **Actor:** Build Tool
- **EntityScope:** Content Pack
- **ErrorModes:** BRANCH-006
- **NFR-Tags:** NFR-006
- **Source:** JOURNEY-003 BRANCH-006
- **Dependencies:** REQ-031, REQ-042
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-078: Given a gate run admitting 119 categories, when the count is checked, then the build exits with a non-zero status.
  - TEST-079: Given the shipped pack, when admitted categories are counted, then the count is at least 120.
- **Assumptions:** Empirical probing shows 1045 candidates passing the gate.
- **OpenQuestions:** none

---

### REQ-047: Exclude answer words from generated share text
- **ID:** REQ-047
- **Title:** Keep share text free of answer words
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Share Module shall generate `shareText` from `totalScore`, `parValue`, `verdict` and `dayId` only.
- **Inputs:** FIELD-017 totalScore, FIELD-013 parValue, FIELD-018 verdict, FIELD-001 dayId
- **Outputs:** FIELD-025 shareText
- **Preconditions:** The round has reached a terminal verdict.
- **Postconditions:** shareText contains no answer word.
- **Invariants:** The Share Module never receives an answer word as input.
- **Trigger:** Share text generation.
- **Actor:** System (Engine)
- **EntityScope:** Spoiler-Safe Share (TERM-021)
- **ErrorModes:** ERROR-011
- **NFR-Tags:** NFR-003
- **Source:** JOURNEY-004 step 4
- **Dependencies:** REQ-015, REQ-016
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-080: Given a completed round, when shareText is generated, then shareText contains neither submitted answer word.
  - TEST-081: Given every answer in the round's Answer List, when each is sought in shareText, then no answer is found.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-048: Label Practice share text distinctly
- **ID:** REQ-048
- **Title:** Mark Practice shares as practice
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When the Share Module generates text for a Practice Round, the Share Module shall include the literal marker "(Practice)" in `shareText`.
- **Inputs:** round mode, FIELD-017 totalScore, FIELD-013 parValue
- **Outputs:** FIELD-025 shareText carrying the practice marker
- **Preconditions:** A Practice Round has reached a terminal verdict.
- **Postconditions:** Practice shares carry no streak wording.
- **Invariants:** Daily shares omit the practice marker.
- **Trigger:** Share generation for a Practice Round.
- **Actor:** System (Engine)
- **EntityScope:** Spoiler-Safe Share
- **ErrorModes:** none
- **NFR-Tags:** NFR-003
- **Source:** ADR-008 (resolved to Accepted by this REQ), JOURNEY-004 BRANCH-008
- **Dependencies:** REQ-047
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-082: Given a completed Practice Round, when shareText is generated, then shareText contains "(Practice)".
  - TEST-083: Given a completed Daily Round, when shareText is generated, then shareText omits "(Practice)".
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-049: Label the answer input for assistive technology
- **ID:** REQ-049
- **Title:** Give the answer input an accessible name
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Lowball view shall assign the answer text input an accessible name naming the current category.
- **Inputs:** FIELD-005 categoryLabel
- **Outputs:** rendered input carrying an accessible name
- **Preconditions:** The round view is rendered.
- **Postconditions:** Assistive technology announces the input purpose.
- **Invariants:** The accessible name is present in every render.
- **Trigger:** View render.
- **Actor:** Hub Shell
- **EntityScope:** Answer
- **ErrorModes:** none
- **NFR-Tags:** NFR-001
- **Source:** JOURNEY-001 step 4
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-084: Given a rendered round view, when the input accessible name is queried, then the name is a non-empty string.
- **Assumptions:** WCAG 2.1 AA is the conformance target.
- **OpenQuestions:** none

---

### REQ-050: Announce each score through a live region
- **ID:** REQ-050
- **Title:** Announce the sweep score to assistive technology
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When a Sweep score is assigned, the Lowball view shall write the numeric score into an ARIA live region.
- **Inputs:** FIELD-009 panelScore
- **Outputs:** live region text content
- **Preconditions:** A Sweep has been consumed.
- **Postconditions:** The score is conveyed without sight of the bar column.
- **Invariants:** The live region carries a polite announcement role.
- **Trigger:** Score assignment.
- **Actor:** Hub Shell
- **EntityScope:** Panel Score
- **ErrorModes:** none
- **NFR-Tags:** NFR-001
- **Source:** JOURNEY-001 step 8
- **Dependencies:** REQ-010
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-085: Given a Sweep scoring 12, when the score is assigned, then the live region text contains "12".
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-051: Render the score as text alongside the bar column
- **ID:** REQ-051
- **Title:** Provide a textual channel for the score
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Lowball view shall render the numeric `panelScore` as text whenever the Tension Counter is displayed.
- **Inputs:** FIELD-009 panelScore, FIELD-019 tickCounter
- **Outputs:** rendered numeric text
- **Preconditions:** A score has been assigned.
- **Postconditions:** The bar column is not the only channel conveying the score.
- **Invariants:** The textual channel is present under reduced motion too.
- **Trigger:** View render after scoring.
- **Actor:** Hub Shell
- **EntityScope:** Tension Counter (TERM-014)
- **ErrorModes:** none
- **NFR-Tags:** NFR-001
- **Source:** JOURNEY-004 step 3, TERM-014 anti-definition
- **Dependencies:** REQ-018
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-086: Given a displayed Tension Counter, when the view text is queried, then the numeric score appears as text.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-052: Distinguish findable from unfindable zero-scorers in the reveal
- **ID:** REQ-052
- **Title:** Badge zero-scoring answers by findability
- **EARS Pattern:** Event-Driven
- **EARS Statement:** When the reveal renders a zero-scoring answer, the Lowball view shall render a badge whose text differs according to that answer's `isFindable` value.
- **Inputs:** FIELD-010 isFindable, FIELD-009 panelScore
- **Outputs:** rendered findability badge
- **Preconditions:** The round has reached a terminal verdict.
- **Postconditions:** A lucky obscure win is distinguishable from a genuine find.
- **Invariants:** Badge text is derived from pack data, not recomputed.
- **Trigger:** Reveal render for a zero-scoring answer.
- **Actor:** Hub Shell
- **EntityScope:** Findability (TERM-010)
- **ErrorModes:** none
- **NFR-Tags:** NFR-001
- **Source:** JOURNEY-004 step 2
- **Dependencies:** REQ-010
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-087: Given a zero-scoring answer with isFindable true, when the reveal renders, then the badge text differs from the unfindable badge text.
  - TEST-088: Given a non-zero-scoring answer, when the reveal renders, then no findability badge is rendered.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-053: Disclose the simulated origin of the panel score
- **ID:** REQ-053
- **Title:** State that the panel is simulated
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Lowball view shall render the literal text "simulated panel of 100 · from corpus frequency" wherever a panel score is presented.
- **Inputs:** none
- **Outputs:** rendered disclosure text
- **Preconditions:** The round view is rendered.
- **Postconditions:** No wording implies a survey of real people.
- **Invariants:** The disclosure accompanies every score presentation.
- **Trigger:** View render.
- **Actor:** Hub Shell
- **EntityScope:** Panel Score
- **ErrorModes:** none
- **NFR-Tags:** NFR-003
- **Source:** Feature brief — honesty constraint, TERM-006 anti-definition
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-089: Given a rendered round view, when the view text is queried, then the text contains "simulated panel of 100".
  - TEST-090: Given a rendered round view, when the view text is queried, then the text omits the phrase "we asked 100 people".
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-054: Register the game in the hub registry
- **ID:** REQ-054
- **Title:** Expose Lowball on the hub selection screen
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The hub registry shall include the Lowball plugin in its ordered game list.
- **Inputs:** Lowball plugin module
- **Outputs:** registry entry
- **Preconditions:** The plugin implements the GamePlugin contract.
- **Postconditions:** Lowball appears on the hub selection screen.
- **Invariants:** The plugin identifier is unique across the registry.
- **Trigger:** Hub registry construction.
- **Actor:** Hub Shell
- **EntityScope:** Daily Round
- **ErrorModes:** none
- **NFR-Tags:** NFR-002
- **Source:** Feature brief — required deliverables
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-091: Given the hub registry, when its entries are enumerated, then one entry carries the identifier "lowball".
  - TEST-092: Given the hub registry, when identifiers are counted, then no identifier appears twice.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-055: Withhold network requests at runtime
- **ID:** REQ-055
- **Title:** Keep Lowball free of runtime network calls
- **EARS Pattern:** Unwanted
- **EARS Statement:** The Lowball plugin shall not issue a network request other than the precached Content Pack asset read.
- **Inputs:** none
- **Outputs:** no outbound request
- **Preconditions:** The plugin is mounted.
- **Postconditions:** The game remains playable without connectivity.
- **Invariants:** No telemetry is emitted.
- **Trigger:** Plugin mount and play.
- **Actor:** System (Engine)
- **EntityScope:** Daily Round
- **ErrorModes:** EDGE-007
- **NFR-Tags:** NFR-003
- **Source:** Feature brief — determinism and offline constraints
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-093: Given the plugin mounted with the network offline, when a full round is played, then the round reaches a terminal verdict.
  - TEST-094: Given the plugin mounted, when outbound requests are recorded, then only the Content Pack asset path appears.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-056: Keep the engine free of platform effects
- **ID:** REQ-056
- **Title:** Confine the engine to pure functions
- **EARS Pattern:** Ubiquitous
- **EARS Statement:** The Lowball engine module shall import no storage, clock or document interface.
- **Inputs:** engine module source
- **Outputs:** engine module free of effect imports
- **Preconditions:** The engine module exists.
- **Postconditions:** Every engine function is deterministic on its arguments.
- **Invariants:** State transitions return new objects.
- **Trigger:** Static analysis of the engine module.
- **Actor:** System (Engine)
- **EntityScope:** Daily Round
- **ErrorModes:** none
- **NFR-Tags:** NFR-004
- **Source:** Feature brief — determinism, ADR-001
- **Dependencies:** none
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-095: Given the engine module source, when its imports are inspected, then no import references a storage, clock or document interface.
  - TEST-096: Given identical arguments, when a submission transition runs twice, then both returned states are deep-equal.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-057: Withhold the share control until the round is terminal
- **ID:** REQ-057
- **Title:** Hide the share control while the verdict is pending
- **EARS Pattern:** State-Driven
- **EARS Statement:** While `verdict` equals "pending", the Lowball view shall omit the share control from the rendered view.
- **Inputs:** FIELD-018 verdict
- **Outputs:** rendered view without a share control
- **Preconditions:** The round view is rendered.
- **Postconditions:** No share text can be generated mid-round.
- **Invariants:** The share control appears only at a terminal verdict.
- **Trigger:** View render while the verdict is pending.
- **Actor:** Hub Shell
- **EntityScope:** Spoiler-Safe Share (TERM-021)
- **ErrorModes:** none
- **NFR-Tags:** NFR-003
- **Source:** Review — Missing Edge Cases item 10
- **Dependencies:** REQ-047
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-097: Given a round whose verdict is "pending", when the round view is rendered, then the share control is absent from the rendered view.
- **Assumptions:** none
- **OpenQuestions:** none

---

### REQ-058: Repair a save state carrying more players than the mode allows
- **ID:** REQ-058
- **Title:** Clamp a tampered players array to one entry
- **EARS Pattern:** Unwanted
- **EARS Statement:** If a loaded Lowball Save State holds more than one entry in its `players` array, then the Hub Shell shall retain only the first entry.
- **Inputs:** FIELD-016 players
- **Outputs:** repaired players array holding one entry
- **Preconditions:** A stored record declares more than one player.
- **Postconditions:** The repaired state matches the single-player scope of v1.
- **Invariants:** Repair never raises an exception.
- **Trigger:** Save State load with an oversized players array.
- **Actor:** Hub Shell
- **EntityScope:** Player Slot (TERM-016)
- **ErrorModes:** EDGE-008
- **NFR-Tags:** NFR-005
- **Source:** Review — Missing Edge Cases item 9
- **Dependencies:** REQ-028
- **Priority:** MUST
- **AcceptanceCriteria:**
  - TEST-098: Given a persisted Save State whose players array holds 3 entries, when the state is loaded, then the repaired state holds exactly 1 player entry.
- **Assumptions:** Future multiplayer modes will raise this bound alongside the mode flag.
- **OpenQuestions:** none

---

## Non-Functional Requirements

| ID | Category | Requirement | Verification |
|---|---|---|---|
| NFR-001 | Accessibility | The Lowball view shall meet WCAG 2.1 AA for the answer input, score announcements and reveal badges. | axe-core scan in CI plus a screen-reader script covering REQ-049, REQ-050, REQ-051, REQ-052 |
| NFR-002 | Maintainability | Persisted state shall carry a schema version and a single migration contract. | REQ-027, REQ-029, REQ-030 unit tests |
| NFR-003 | Privacy and honesty | No runtime network call, no telemetry, no wording implying a real survey, no answer word in share text. | REQ-044, REQ-047, REQ-053, REQ-055, REQ-057 tests |
| NFR-004 | Determinism | Identical inputs shall yield identical verdicts under iOS WKWebView, Android WebView and desktop Chromium. | REQ-001, REQ-056 golden-vector tests across three Playwright runtimes |
| NFR-005 | Fault tolerance | Player input and corrupt storage shall never raise an exception reaching the view. | REQ-006, REQ-009, REQ-028, REQ-040, REQ-058 tests |
| NFR-006 | Content quality | Every shipped category shall satisfy all Fairness Gate rules and the pack shall stay within budget. | REQ-031 to REQ-035, REQ-042, REQ-045, REQ-046 content tests |

---

## Atomicity Statement

All 58 requirements above were checked against A1–A8 (structural atomicity), V1–V10 (vague-word
lint) and S1–S6 (schema completeness). Each requirement carries exactly one EARS pattern, one
trigger, one actor, one entity scope, and at most three acceptance criteria. Each acceptance
criterion carries a unique TEST identifier in the range TEST-001 to TEST-098. No requirement
carries a blocking open question.
