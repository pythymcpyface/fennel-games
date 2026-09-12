Feature: REQ-015 — Declare a win when the total is strictly below par
  As the Lowball engine, I set verdict to "win" when totalScore is strictly below parValue.

  @REQ-015 @AC-015-1
  Scenario: totalScore strictly below parValue yields a win
    # TEST-028
    Given totalScore is 19
    And parValue is 21
    When the verdict is computed
    Then the verdict is "win"