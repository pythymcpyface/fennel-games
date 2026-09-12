Feature: REQ-026 — Tiebreak round 1 sole winner designation
  As the system, I designate a sole winner when tiebreak round 1 breaks the tie so that the round concludes.

  @REQ-026 @AC-026-1
  Scenario: Tiebreak round 1 produces a unique lowest total among tied players
    # TEST-037
    Given a tiebreak round 1 is underway between two tied players
    When the tiebreak sweep totals are computed as 10 and 30
    Then the player with tiebreak total 10 is designated the sole winner