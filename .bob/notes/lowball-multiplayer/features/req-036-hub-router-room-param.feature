Feature: REQ-036 — Hub router passes ?room= param to lowball plugin
  As a user, I follow an invite link so that the room code is passed to the game plugin.

  @REQ-036 @AC-036-1
  Scenario: Hub router forwards the room query parameter to the lowball plugin
    # TEST-048, TEST-049
    Given the user navigates to the hub with URL containing "?room=AB12CD" for the lowball game
    When the hub router loads the lowball plugin
    Then the lowball plugin receives "room" equal to "AB12CD"