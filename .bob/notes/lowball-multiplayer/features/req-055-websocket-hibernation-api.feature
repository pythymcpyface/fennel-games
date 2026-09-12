Feature: REQ-055 — WebSocket Hibernation API used
  As the system, I use the Hibernation API so that Durable Objects remain cost-efficient.

  @REQ-055 @AC-055-1
  Scenario: Durable Object accepts WebSocket connections via the Hibernation API
    # TEST-070
    Given a client initiates a WebSocket connection to the Durable Object
    When the Durable Object accepts the connection
    Then the Durable Object calls "ctx.acceptWebSocket" to accept the connection
    And the Durable Object does not call "ws.accept()"