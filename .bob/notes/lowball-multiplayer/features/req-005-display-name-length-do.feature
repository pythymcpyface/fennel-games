Feature: REQ-005 — Display name length enforcement at DO (1-20 chars)
  As the system, I enforce display name length so that stored names remain valid.

  @REQ-005 @AC-005-1
  Scenario Outline: DO enforces display name length boundaries
    # TEST-006, TEST-007, TEST-008
    Given a player attempts to join or create a room with display name "<name>"
    When the Durable Object validates the display name
    Then the DO response is "<result>"

    Examples:
      | name                    | result   |
      | ""                      | REJECTED |
      | A                       | ACCEPTED |
      | AAAAAAAAAAAAAAAAAAAA    | ACCEPTED |
      | AAAAAAAAAAAAAAAAAAAAA   | REJECTED |