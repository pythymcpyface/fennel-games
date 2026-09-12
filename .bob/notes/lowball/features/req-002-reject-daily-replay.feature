Feature: REQ-002 — Reject Daily Round replay within the same UTC day
  As the Lowball engine, I keep the categoryId stable for the remainder of the UTC day.

  @REQ-002 @AC-002-1
  Scenario: Reopening the Daily Round on the same UTC day keeps categoryId unchanged
    # TEST-003
    Given a Daily Save State with today's dayId and categoryId "X"
    When the Player reopens the Daily Round entry point
    Then categoryId remains "X"