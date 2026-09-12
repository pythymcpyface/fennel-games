Feature: REQ-013 — Compute the total as the sum of both sweep scores
  As the Lowball engine, I sum both panelScore values into totalScore.

  @REQ-013 @AC-013-1
  Scenario: Total is the sum of two non-zero sweep scores
    # TEST-024
    Given sweep 0 panelScore is 12
    And sweep 1 panelScore is 7
    When the round completes
    Then totalScore is 19

  @REQ-013 @AC-013-2
  Scenario: Total is zero when both sweep scores are zero
    # TEST-025
    Given sweep 0 panelScore is 0
    And sweep 1 panelScore is 0
    When the round completes
    Then totalScore is 0