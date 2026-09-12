Feature: REQ-030 — Leaderboard rank assignment (standard competition ranking)
  As a player, I see correctly ranked results so that standings are fair.

  @REQ-030 @AC-030-1
  Scenario: Ranks are assigned using standard competition ranking with ties
    # TEST-042
    Given round totals for four players are 10, 20, 20, and 40
    When the Durable Object computes the leaderboard ranks
    Then the ranks assigned are 1, 2, 2, and 4 respectively