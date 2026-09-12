Feature: REQ-001 — Room code generation format
  As a host, I generate a room so that others can join using a shareable code.

  @REQ-001 @AC-001-1
  Scenario: Generated room code matches required format
    # TEST-001
    Given the host requests creation of a new room
    When the server generates a room code
    Then the room code matches the pattern "[A-Z0-9]{6}"