Feature: REQ-019 — Early sweep advance when all players submit
  As a player, I advance quickly to the next sweep when everyone has submitted so that I don't wait unnecessarily.

  @REQ-019 @AC-019-1
  Scenario: Sweep advances early when all players have submitted before the deadline
    # TEST-029
    Given a room has 2 players and the sweep deadline has not yet been reached
    When both players submit their words
    Then the Durable Object advances to the next sweep phase immediately
    And the Durable Object does not wait for the sweep deadline