Feature: REQ-019 — Decrement the tick counter by one per advance call
  As the Lowball engine, I decrement tickCounter by exactly one per advanceTick call while above target.

  @REQ-019 @AC-019-1
  Scenario: A single advanceTick call decrements tickCounter by one
    # TEST-033
    Given a RoundState with tick 100 and a target score of 98
    When advanceTick is called
    Then the tick counter decreases by exactly one discrete step

  @REQ-019 @AC-019-2
  Scenario: Repeated advanceTick calls drive the counter down to the target
    # TEST-034
    Given a RoundState with tick 100 and a target score of 0
    When advanceTick is called repeatedly until tick equals 0
    Then the tick counter decreases by exactly one discrete step