Feature: REQ-013 — Sweep-start broadcast with deadline
  As a player, I receive the sweep deadline so that I know how much time remains.

  @REQ-013 @AC-013-1
  Scenario: Sweep-start message includes sweepIndex and correct deadline timestamp
    # TEST-020, TEST-021
    Given a round has begun in a room at server time "T0"
    When the server starts a sweep with sweepIndex 0
    Then the server broadcasts a sweep-start message containing sweepIndex 0
    And the broadcasted sweepDeadlineTimestamp equals "T0" plus 30000 milliseconds