Feature: REQ-062 — Display name empty validation on join (client)
  As a user, I am prevented from joining a room with an empty display name so that all players are identifiable.

  @REQ-062 @AC-062-1
  Scenario: Client blocks room join with empty display name
    # TEST-077
    Given the user is on the join-room page with a valid room code entered
    When the user submits the join-room form with an empty display name
    Then the client displays a validation error
    And the client does not send a join-room request to the server