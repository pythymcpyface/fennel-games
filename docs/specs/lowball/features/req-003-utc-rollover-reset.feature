Feature: REQ-003 — Reset Daily Round on UTC day rollover
  As the Lowball engine, I initialise a fresh Daily Round when the saved dayId is stale.

  @REQ-003 @AC-003-1
  Scenario: A stale pending round is reinitialised at sweepIndex 0
    # TEST-004
    Given a saved dayId of yesterday with sweepIndex 1 pending
    When the Hub Shell loads the Daily Save State today
    Then a new round is initialized with sweepIndex 0

  @REQ-003 @AC-003-2
  Scenario: Reinitialising a stale round leaves the Stats Record played count unchanged
    # TEST-005
    Given a saved dayId of yesterday with sweepIndex 1 pending
    When the Hub Shell loads the Daily Save State today
    Then the old pending round is NOT counted toward the Stats Record