Feature: REQ-042 — multiplayer-client.ts is sole WebSocket module
  As a maintainer, I ensure WebSocket logic is isolated so that the codebase remains maintainable.

  @REQ-042 @AC-042-1
  Scenario: Only multiplayer-client.ts contains WebSocket usage on the client side
    # TEST-056
    Given the client source tree is scanned for WebSocket API usage
    When the scan completes
    Then only "multiplayer-client.ts" contains WebSocket constructor or API calls
    And no other client source file references the WebSocket API