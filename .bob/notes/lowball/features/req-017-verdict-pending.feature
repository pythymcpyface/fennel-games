Feature: REQ-017 — Hold the verdict pending until both sweeps are consumed
  As the Lowball engine, I keep verdict as "pending" until both Sweeps are consumed.

  @REQ-017 @AC-017-1
  Scenario: verdict stays pending while sweepIndex is below 2
    # TEST-031
    Given a round at sweepIndex 1
    When the verdict is computed
    Then the verdict is "pending"