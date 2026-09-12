Feature: REQ-029 — lowball.json bundled in Worker at startup
  As the system, I bundle the content pack so that no runtime fetch is required.

  @REQ-029 @AC-029-1
  Scenario: Content pack is loaded from the bundle at Worker startup without a network fetch
    Given the Worker process starts
    When the Worker initializes the content pack
    Then the Worker loads lowball.json from the bundled assets
    And the Worker does not perform a runtime network fetch for the content pack