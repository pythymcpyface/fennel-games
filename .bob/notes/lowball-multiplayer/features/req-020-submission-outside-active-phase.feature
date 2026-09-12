Feature: REQ-020 — Submission rejected outside active sweep phase
  As the system, I reject out-of-phase submissions so that game state stays consistent.

  @REQ-020 @AC-020-1
  Scenario: Submission sent outside the active sweep phase is rejected
    # TEST-030
    Given a room is not currently in an active sweep phase
    When a player sends a submission message
    Then the Durable Object rejects the submission