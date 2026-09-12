Feature: REQ-033 — Guest disconnect decrements roomPlayerCount
  As the system, I track player count accurately so that lobby capacity checks remain correct.

  @REQ-033 @AC-033-1
  Scenario: Guest disconnect decrements the room player count
    # TEST-045
    Given a room has a roomPlayerCount of 3
    When a non-host player disconnects from the room
    Then the roomPlayerCount decrements to 2