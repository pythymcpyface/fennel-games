Feature: REQ-012 — Daily puzzle broadcast on round start
  As a player, I receive the puzzle details so that I can begin the round.

  @REQ-012 @AC-012-1
  Scenario: Puzzle details are broadcast when the round starts
    # TEST-019
    Given a room has started a game round
    When the round begins
    Then the server broadcasts a puzzle message containing categoryLabel, parValue, and puzzleId to all players