Feature: REQ-003 — Host player slot 0, isHost=true
  As the host, I am assigned slot 0 so that I am recognized as the room owner.

  @REQ-003 @AC-003-1
  Scenario: Host is assigned slot 0 with isHost true
    # TEST-003, TEST-004
    Given a player creates a new room
    When the room is created
    Then the creating player occupies player slot 0
    And the creating player has isHost equal to true
    And exactly one player in the room has isHost equal to true