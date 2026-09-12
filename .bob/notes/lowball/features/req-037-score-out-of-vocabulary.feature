Feature: REQ-037 — Score an out-of-vocabulary answer as zero
  As the Build Tool, I assign panelScore 0 to answers absent from the GloVe vocabulary.

  @REQ-037 @AC-037-1
  Scenario: An out-of-vocabulary answer scores zero
    # TEST-065
    Given a word with GloVe rank null
    When the panel score formula is applied
    Then panelScore equals 0