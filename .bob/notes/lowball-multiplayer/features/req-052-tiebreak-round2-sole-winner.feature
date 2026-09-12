Feature: REQ-052 — Tiebreak round 2 sole winner designation
  As the system, I designate a sole winner when tiebreak round 2 breaks the tie so that the round concludes.

  @REQ-052 @AC-052-1
  Scenario: Tiebreak round 2 produces a unique lowest total among tied players
    # TEST-066
    Given a tiebreak round 2 is underway between two tied players
    When the tiebreak round 2 sweep totals are computed as 15 and 25
    Then the player with tiebreak total 15 is designated the sole winner