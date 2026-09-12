Feature: REQ-037 — Other 49 games unaffected by hub router change
  As a user of any other game, I experience no regression from the hub router change.

  @REQ-037 @AC-037-1
  Scenario: Non-lowball games load without receiving unexpected room parameters
    # TEST-050
    Given the hub router is updated to support the lowball room parameter
    When a user navigates to any of the other 49 games without a "room" parameter
    Then the hub router loads the requested game plugin without errors
    And the game plugin does not receive a "room" parameter