Feature: REQ-012 — Refuse submission once the round is terminal
  As the Lowball engine, I refuse further submissions once both Sweeps are consumed.

  Background:
    Given a round at sweepIndex 2

  @REQ-012 @AC-012-1
  Scenario: A submission after two consumed Sweeps returns the state unchanged
    # TEST-022
    When an invalid answer is submitted
    Then both returned states are deep-equal

  @REQ-012 @AC-012-2
  Scenario: A submission after two consumed Sweeps returns the no_sweeps_remaining marker
    # TEST-023
    When an invalid answer is submitted
    Then the returned error marker equals "no_sweeps_remaining"