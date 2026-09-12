Feature: REQ-023 — Exclude Practice results from the Stats Record
  As the Hub Shell, I do not write the Stats Record during a Practice Round.

  @REQ-023 @AC-023-1
  Scenario: Winning a Practice Round leaves the Stats Record unchanged
    # TEST-039
    Given the Player completes a Practice Round ending in a "win" verdict
    When the Practice round state is persisted
    Then updateStatsRecord is NOT called

  @REQ-023 @AC-023-2
  Scenario: Losing a Practice Round leaves the Stats Record unchanged
    # TEST-040
    Given the Player completes a Practice Round ending in a "loss" verdict
    When the Practice round state is persisted
    Then updateStatsRecord is NOT called