Feature: REQ-031 — Leaderboard broadcast to all clients within 500ms
  As a player, I receive leaderboard updates promptly so that results feel real-time.

  @REQ-031 @AC-031-1
  Scenario: Leaderboard is broadcast to all clients within 500 milliseconds of round completion
    # TEST-043
    Given a round has just completed in a room with 3 connected players
    When the Durable Object finalizes the round outcome
    Then the leaderboard is broadcast to all 3 clients within 500 milliseconds