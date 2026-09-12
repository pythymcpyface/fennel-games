Feature: REQ-038 — Score a specialist-tier answer as zero
  As the Build Tool, I assign panelScore 0 to answers above SCOWL tier 50.

  @REQ-038 @AC-038-1
  Scenario: A specialist-tier answer scores zero despite a resolved GloVe rank
    # TEST-066
    Given a word with GloVe rank 4200
    And its SCOWL tier is 70
    When the panel score formula is applied
    Then panelScore equals 0