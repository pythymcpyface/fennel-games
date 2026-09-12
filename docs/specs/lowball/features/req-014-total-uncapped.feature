Feature: REQ-014 — Leave the total uncapped above 100
  As the Lowball engine, I record totalScore above 100 without clamping.

  @REQ-014 @AC-014-1
  Scenario: Two mid-range scores sum above 100 without clamping
    # TEST-026
    Given sweep 0 panelScore is 60
    And sweep 1 panelScore is 60
    When the round completes
    Then totalScore is 120

  @REQ-014 @AC-014-2
  Scenario: Two maximum scores sum to 200 without clamping
    # TEST-027
    Given sweep 0 panelScore is 100
    And sweep 1 panelScore is 100
    When the round completes
    Then totalScore is 200