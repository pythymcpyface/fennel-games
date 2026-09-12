Feature: REQ-027 — Tiebreak round 2 entry on continued tie
  As the system, I initiate a second tiebreak round when the first tiebreak also ties so that resolution continues.

  @REQ-027 @AC-027-1
  Scenario: Continued tie in tiebreak round 1 initiates tiebreak round 2
    # TEST-038
    Given tiebreak round 1 totals are equal for both tied players
    When the Durable Object evaluates the tiebreak round 1 outcome
    Then the Durable Object initiates a tiebreak round with tiebreakRoundNumber 2