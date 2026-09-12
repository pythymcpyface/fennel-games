Feature: REQ-050 — Reconnect after deadline has no effect
  As the system, I ensure late reconnects do not override the auto-blank so that scoring integrity is preserved.

  @REQ-050 @AC-050-1
  Scenario: Player reconnecting after the sweep deadline cannot override the auto-blank
    # TEST-064
    Given a player disconnected during an active sweep and did not submit before the deadline
    And the sweep deadline has passed with an auto-blank recorded for that player
    When the player reconnects after the sweepDeadlineTimestamp
    Then the Durable Object does not allow a new submission for the closed sweep
    And the auto-blank result for that player stands