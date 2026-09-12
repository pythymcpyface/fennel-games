Feature: REQ-020 — Hold the tick counter at the target score
  As the Lowball engine, I leave tickCounter unchanged once it reaches the target panelScore.

  @REQ-020 @AC-020-1
  Scenario: advanceTick is a no-op once tickCounter equals panelScore
    # TEST-035
    Given a RoundState with tick 12 and a target score of 12
    When advanceTick is called repeatedly until tick equals 12
    Then tickCounter equals 12