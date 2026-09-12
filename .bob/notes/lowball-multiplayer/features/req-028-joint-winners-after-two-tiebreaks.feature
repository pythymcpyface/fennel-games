Feature: REQ-028 — Joint winners declared after 2 tiebreak rounds
  As the system, I declare joint winners after two tied tiebreak rounds so that the game concludes.

  @REQ-028 @AC-028-1
  Scenario: Tiebreak round 2 also ties resulting in joint winners
    # TEST-039
    Given tiebreak round 2 totals are equal for both tied players
    When the Durable Object evaluates the tiebreak round 2 outcome
    Then the Durable Object designates both players as joint winners with isJointWinner true