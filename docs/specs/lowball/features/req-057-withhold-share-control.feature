Feature: REQ-057 — Withhold the share control until the round is terminal
  As the Lowball view, I omit the share control while verdict is pending.

  @REQ-057 @AC-057-1
  Scenario: The share control is absent while the verdict is pending
    # TEST-097
    Given a round whose verdict is "pending"
    When the round view is rendered
    Then the share control is absent from the rendered view