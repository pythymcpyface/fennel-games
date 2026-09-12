Feature: REQ-022 — Round total = sum of 2 sweep panelScores per player
  As the system, I compute round totals so that winners can be determined.

  @REQ-022 @AC-022-1
  Scenario: Round total is the sum of both sweep panelScores for a player
    # TEST-032, TEST-033
    Given a player has a panelScore of 20 in sweep 0 and a panelScore of 35 in sweep 1
    When the Durable Object computes the round total for that player
    Then the round total equals 55