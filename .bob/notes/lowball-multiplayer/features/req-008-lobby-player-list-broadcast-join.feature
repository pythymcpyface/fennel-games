Feature: REQ-008 — Lobby player list broadcast on join
  As a lobby participant, I see the updated player list so that I know who has joined.

  @REQ-008 @AC-008-1
  Scenario: Player list is broadcast to all clients when a player joins
    # TEST-012
    Given a room "AB12CD" has 1 player in the lobby
    When a second player joins room "AB12CD"
    Then the server broadcasts the updated player list to all connected clients in room "AB12CD"
    And the broadcasted player list contains 2 players