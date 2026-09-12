Feature: REQ-011 — Join-after-start rejected ROOM_IN_PROGRESS
  As the system, I prevent late joins so that game state stays consistent.

  @REQ-011 @AC-011-1
  Scenario: Join attempt after game has started is rejected
    # TEST-018
    Given a room "AB12CD" has already started its game
    When a new player attempts to join room "AB12CD"
    Then the server rejects the join with error code "ROOM_IN_PROGRESS"