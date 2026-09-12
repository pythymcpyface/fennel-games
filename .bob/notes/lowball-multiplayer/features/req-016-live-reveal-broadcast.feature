Feature: REQ-016 — Live reveal broadcast on submission
  As a player, I see submissions revealed live so that I can follow the round in real time.

  @REQ-016 @AC-016-1
  Scenario: Submission triggers immediate live reveal broadcast
    # TEST-025
    Given a sweep is active in a room with 2 connected players
    When a player submits a word
    Then the server immediately broadcasts a live reveal message to all connected clients in the room