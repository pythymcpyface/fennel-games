Feature: REQ-018 — Auto-blank on sweep timeout
  As the system, I auto-blank non-submitting players so that rounds can complete.

  @REQ-018 @AC-018-1
  Scenario: Non-submitting player receives auto-blank at sweep timeout
    # TEST-027, TEST-028
    Given a sweep deadline has been reached and a player has not submitted a word
    When the Durable Object closes the sweep at the deadline
    Then the Durable Object records an auto-blank for that player with panelScore 100 and verdict "TIMEOUT"