Feature: REQ-016 — Declare a loss when the total equals or exceeds par
  As the Lowball engine, I set verdict to "loss" when totalScore is at least parValue.

  @REQ-016 @AC-016-1
  Scenario: totalScore equal to parValue yields a loss
    # TEST-029
    Given totalScore is 21
    And parValue is 21
    When the verdict is computed
    Then the verdict is "loss"

  @REQ-016 @AC-016-2
  Scenario: totalScore above parValue yields a loss
    # TEST-030
    Given totalScore is 90
    And parValue is 21
    When the verdict is computed
    Then the verdict is "loss"