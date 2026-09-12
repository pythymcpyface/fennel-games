Feature: REQ-048 — Spectator view for non-tied players during tiebreak
  As a non-tied player, I watch the tiebreak as a spectator so that I stay engaged with the game.

  @REQ-048 @AC-048-1
  Scenario: Non-tied players see a spectator view during a tiebreak round
    # TEST-062
    Given a tiebreak round is underway between two tied players out of four total players
    When the two non-tied players view the client during the tiebreak
    Then the two non-tied players are shown a spectator view of the tiebreak