Feature: REQ-026 — Retain a single Practice round slot
  As the Hub Shell, I overwrite the existing Practice Save State when a new Practice Round starts.

  @REQ-026 @AC-026-1
  Scenario: Starting a new Practice Round overwrites the prior stored round
    # TEST-045
    Given a completed Practice round already stored under storageKeyPractice
    When a new Practice Round starts
    Then Practice Save State holds only the new round