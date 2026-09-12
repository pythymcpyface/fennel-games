Feature: REQ-021 — Submission word length cap
  As the system, I cap word length so that malformed submissions do not disrupt scoring.

  @REQ-021 @AC-021-1
  Scenario: Submission exceeding 50 characters is treated as invalid
    # TEST-031
    Given a sweep is active for a room
    When a player submits a word that is 51 characters long
    Then the Durable Object marks the submission as invalid with panelScore 100