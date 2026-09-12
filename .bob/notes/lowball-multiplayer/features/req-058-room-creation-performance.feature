Feature: REQ-058 — Room creation within 500ms
  As a user, I experience fast room creation so that I can start playing quickly.

  @REQ-058 @AC-058-1
  Scenario: Room creation completes within the performance budget
    # TEST-073
    Given a user requests creation of a new room
    When the server processes the room creation request
    Then the server completes room creation within 500 milliseconds