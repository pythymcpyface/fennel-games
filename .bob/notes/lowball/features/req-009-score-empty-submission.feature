Feature: REQ-009 — Score an empty submission as the maximum penalty
  As the Lowball engine, I penalise submissions that normalise to an empty string.

  @REQ-009 @AC-009-1
  Scenario: A whitespace-only submission scores 100
    # TEST-016
    Given the raw submission "   "
    When the Player submits "   "
    Then the sweep's panelScore is set to 100

  @REQ-009 @AC-009-2
  Scenario: A digits-only submission scores 100
    # TEST-017
    Given the raw submission "123"
    When the Player submits "123"
    Then the sweep's panelScore is set to 100