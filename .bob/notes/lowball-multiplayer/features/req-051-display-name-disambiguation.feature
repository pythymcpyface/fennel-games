Feature: REQ-051 — Display name duplicate disambiguation
  As a player, I receive a disambiguated display name so that I am distinguishable from other players with the same name.

  @REQ-051 @AC-051-1
  Scenario: Duplicate display names are disambiguated with numeric suffixes
    # TEST-065
    Given a room already contains a player named "Alex"
    When a second player joins the room with display name "Alex"
    Then the second player's display name is set to "Alex-2"

  @REQ-051 @AC-051-2
  Scenario: Third duplicate display name receives the next available suffix
    Given a room already contains players named "Alex" and "Alex-2"
    When a third player joins the room with display name "Alex"
    Then the third player's display name is set to "Alex-3"