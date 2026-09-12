Feature: REQ-059 — Lobby player list broadcast after guest disconnect
  As a lobby participant, I see the updated player list so that I know who has left.

  @REQ-059 @AC-059-1
  Scenario: Player list is broadcast to all remaining clients when a guest disconnects
    # TEST-074
    Given a room "AB12CD" has 3 players in the lobby
    When one non-host player disconnects from room "AB12CD"
    Then the server broadcasts the updated player list to all remaining connected clients
    And the broadcasted player list contains 2 players