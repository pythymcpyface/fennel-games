Feature: REQ-024 — Tiebreak entry when 2+ players share lowest total
  As the system, I initiate a tiebreak when totals tie so that a winner can be determined fairly.

  @REQ-024 @AC-024-1
  Scenario: Two players sharing the lowest total enter a tiebreak round
    # TEST-035
    Given round totals are 40, 40, and 80 for three players
    When the Durable Object determines the round outcome
    Then the Durable Object initiates a tiebreak round with tiebreakRoundNumber 1
    And only the two players with round total 40 participate in the tiebreak