Feature: REQ-010 — Host-only start game enforcement at DO
  As the system, I enforce host-only start authority so that non-hosts cannot start games improperly.

  @REQ-010 @AC-010-1
  Scenario: Non-host start attempt is rejected by DO
    # TEST-016
    Given a room has 2 players and player at slot 1 is not the host
    When the player at slot 1 sends a start-game message
    Then the Durable Object rejects the start-game request
    And the room remains in the lobby phase

  @REQ-010 @AC-010-2
  Scenario: Host start attempt with fewer than 2 players is rejected by DO
    # TEST-017
    Given a room has 1 player who is the host
    When the host sends a start-game message
    Then the Durable Object rejects the start-game request
    And the room remains in the lobby phase