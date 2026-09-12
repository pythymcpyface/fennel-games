Feature: REQ-035 — Host disconnect mid-round broadcasts HOST_LEFT
  As a player, I am informed when the host disconnects mid-round so that I understand the game state.

  @REQ-035 @AC-035-1
  Scenario: Host disconnecting during an active round triggers a HOST_LEFT broadcast
    # TEST-047
    Given a room is in an active round with the host connected
    When the host disconnects from the room
    Then the Durable Object broadcasts a "HOST_LEFT" message to all remaining clients