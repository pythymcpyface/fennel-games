Feature: REQ-049 — Reconnect before deadline allows resubmission
  As a player, I can reconnect before the deadline so that I don't lose my chance to submit.

  @REQ-049 @AC-049-1
  Scenario: Player reconnecting before the sweep deadline can still submit
    # TEST-063
    Given a player disconnected during an active sweep before the deadline
    When the player reconnects before the sweepDeadlineTimestamp
    Then the Durable Object allows the reconnected player to submit a word for the current sweep