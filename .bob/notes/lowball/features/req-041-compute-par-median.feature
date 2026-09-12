Feature: REQ-041 — Compute par as the median findable answer score
  As the Build Tool, I compute parValue as the median panelScore of findable answers.

  @REQ-041 @AC-041-1
  Scenario: Par is the median of five findable scores
    # TEST-070
    Given a category whose findable answers score "0, 2, 21, 41, 95"
    When parValue is computed
    Then parValue equals 21