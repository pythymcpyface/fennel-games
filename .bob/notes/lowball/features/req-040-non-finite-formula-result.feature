Feature: REQ-040 — Treat a non-finite formula result as zero
  As the Build Tool, I record panelScore 0 and log a build report entry for non-finite formula results.

  @REQ-040 @AC-040-1
  Scenario: A GloVe rank of zero producing a non-finite logarithm scores zero
    # TEST-069
    Given a word with GloVe rank 0
    When the panel score formula is applied
    Then panelScore equals 0