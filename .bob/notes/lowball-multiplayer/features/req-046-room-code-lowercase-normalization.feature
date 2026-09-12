Feature: REQ-046 — Room code lowercase normalization to uppercase
  As a user, I can enter a room code in lowercase so that I can join without worrying about case.

  @REQ-046 @AC-046-1
  Scenario: Lowercase room code input is normalized to uppercase before lookup
    # TEST-060
    Given a room exists with code "AB12CD"
    When a player enters the room code "ab12cd" to join
    Then the server normalizes the input to "AB12CD"
    And the player successfully joins the room