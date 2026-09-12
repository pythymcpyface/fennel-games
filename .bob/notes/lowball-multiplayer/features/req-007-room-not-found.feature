Feature: REQ-007 — Unknown room code rejected ROOM_NOT_FOUND
  As a user, I receive a clear error so that I know the room code was invalid.

  @REQ-007 @AC-007-1
  Scenario: Joining an unknown room code is rejected
    # TEST-011
    Given no room exists with code "ZZZZZZ"
    When a player attempts to join room "ZZZZZZ"
    Then the server rejects the join with error code "ROOM_NOT_FOUND"