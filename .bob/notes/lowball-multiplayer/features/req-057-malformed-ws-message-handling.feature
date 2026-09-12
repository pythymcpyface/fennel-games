Feature: REQ-057 — Malformed WS message sends error reply, does not crash DO
  As the system, I handle malformed messages gracefully so that the room remains stable for other players.

  @REQ-057 @AC-057-1
  Scenario: Malformed WebSocket message results in an error reply without crashing the Durable Object
    # TEST-072
    Given a client is connected to a room's Durable Object
    When the client sends a malformed WebSocket message payload
    Then the Durable Object sends an error reply to that client
    And the Durable Object continues operating normally for all other connected clients