Feature: REQ-054 — Sweep submission race resolution
  As the system, I resolve races between submission and alarm firing so that outcomes are deterministic.

  @REQ-054 @AC-054-1
  Scenario: Submission arriving just before the alarm fires wins the race
    # TEST-069
    Given a sweep deadline alarm is scheduled to fire at time "T"
    When a player's submission is received by the Durable Object at time "T minus 1 millisecond"
    Then the Durable Object records the player's submission
    And the Durable Object does not apply an auto-blank for that player