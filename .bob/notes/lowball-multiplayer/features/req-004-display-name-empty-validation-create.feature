Feature: REQ-004 — Display name empty validation on create (client)
  As a user, I am prevented from creating a room with an empty display name so that all players are identifiable.

  @REQ-004 @AC-004-1
  Scenario: Client blocks room creation with empty display name
    # TEST-005
    Given the user is on the create-room page
    When the user submits the create-room form with an empty display name
    Then the client displays a validation error
    And the client does not send a create-room request to the server