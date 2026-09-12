Feature: REQ-006 — 5th join rejected ROOM_FULL
  As the system, I limit rooms to 4 players so that game balance is preserved.

  @REQ-006 @AC-006-1
  Scenario: Fifth join attempt is rejected with ROOM_FULL
    # TEST-009, TEST-010
    Given a room already contains 4 players
    When a fifth player attempts to join the room
    Then the server rejects the join with error code "ROOM_FULL"
    And the room player count remains 4