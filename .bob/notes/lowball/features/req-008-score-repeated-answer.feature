Feature: REQ-008 — Score a repeated answer as the maximum penalty
  As the Lowball engine, I penalise a Sweep 1 answer that duplicates the Sweep 0 answer.

  Background:
    Given sweep 0 panelScore is 12

  @REQ-008 @AC-008-1
  Scenario: Repeating the exact Sweep 0 answer in Sweep 1 scores 100
    # TEST-014
    Given a category with Answer List containing "though"
    When the Player submits "though"
    Then the sweep's panelScore is set to 100

  @REQ-008 @AC-008-2
  Scenario: A normalised-equal repeat is flagged as a duplicate
    # TEST-015
    Given a category with Answer List containing "though"
    When the Player submits "THOUGH  "
    Then isDuplicateOfEarlierAnswer is true