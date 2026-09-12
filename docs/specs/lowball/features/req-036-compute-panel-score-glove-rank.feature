Feature: REQ-036 — Compute the panel score from GloVe rank
  As the Build Tool, I compute panelScore from the GloVe rank formula for findable in-vocabulary answers.

  @REQ-036 @AC-036-1
  Scenario: A high-frequency findable word scores 100
    # TEST-063
    Given a word with GloVe rank 132
    And its SCOWL tier is 10
    When the panel score formula is applied
    Then the computed panelScore equals 100.0 within tolerance 0.5

  @REQ-036 @AC-036-2
  Scenario: A low-frequency findable word scores 6
    # TEST-064
    Given a word with GloVe rank 40445
    And its SCOWL tier is 35
    When the panel score formula is applied
    Then the computed panelScore equals 6.0 within tolerance 0.5