Feature: REQ-045 — DO processes each WS message within 200ms
  As a player, I experience responsive gameplay so that the game feels real-time.

  @REQ-045 @AC-045-1
  Scenario: Durable Object processes a WebSocket message within the performance budget
    # TEST-059
    Given a Durable Object is handling an active room
    When a client sends a WebSocket message to the Durable Object
    Then the Durable Object completes processing of the message within 200 milliseconds