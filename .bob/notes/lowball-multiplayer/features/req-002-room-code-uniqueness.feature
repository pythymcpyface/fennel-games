Feature: REQ-002 — Room code uniqueness on collision
  As the system, I ensure room codes are unique so that players join the correct room.

  @REQ-002 @AC-002-1
  Scenario: Room code collision triggers retry with new code
    # TEST-002
    Given an existing room already uses code "AB12CD"
    When the server generates a new room code that collides with "AB12CD"
    Then the server retries generation until a unique room code is produced
    And the final room code does not equal "AB12CD"