Feature: REQ-050 — Announce each score through a live region
  As the Lowball view, I write the assigned score into an ARIA live region.

  @REQ-050 @AC-050-1
  Scenario: A sweep score is announced through the live region
    # TEST-085
    Given a sweep that has just been scored 12
    When the sweep score is assigned
    And the live region content is read
    Then the live region text contains "12"