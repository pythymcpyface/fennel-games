Feature: REQ-023 — Unique lowest total = sole winner designation
  As the system, I designate a sole winner when totals are unique so that results are clear.

  @REQ-023 @AC-023-1
  Scenario: Player with the unique lowest round total is designated sole winner
    # TEST-034
    Given round totals are 40, 60, and 80 for three players
    When the Durable Object determines the round outcome
    Then the player with round total 40 is designated the sole winner