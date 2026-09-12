Feature: REQ-039 — Clamp the computed panel score to 0 through 100
  As the Build Tool, I clamp every computed panelScore into 0 through 100.

  @REQ-039 @AC-039-1
  Scenario: A rank of 1 clamps to the maximum score of 100
    # TEST-067
    Given a word with GloVe rank 1
    When the panel score formula is applied
    Then panelScore equals 100

  @REQ-039 @AC-039-2
  Scenario: A tail-vocabulary rank clamps to at least zero
    # TEST-068
    Given a word with GloVe rank 400000
    When the panel score formula is applied
    Then panelScore is greater than or equal to 0