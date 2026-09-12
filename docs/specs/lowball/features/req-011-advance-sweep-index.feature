Feature: REQ-011 — Advance the sweep index after a consumed sweep
  As the Lowball engine, I increment sweepIndex by one whenever a Sweep is consumed.

  @REQ-011 @AC-011-1
  Scenario: sweepIndex advances after a valid answer
    # TEST-020
    Given a round at sweepIndex 0
    When a valid answer is submitted
    Then sweepIndex equals 1

  @REQ-011 @AC-011-2
  Scenario: sweepIndex advances after an invalid answer
    # TEST-021
    Given a round at sweepIndex 0
    When an invalid answer is submitted
    Then sweepIndex equals 1