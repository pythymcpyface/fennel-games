Feature: REQ-025 — Exclude today's Daily category from Practice selection
  As the Lowball engine, I avoid selecting today's Daily category for Practice when alternatives exist.

  @REQ-025 @AC-025-1
  Scenario: A colliding Practice selection advances to a different category
    # TEST-043
    Given today's Daily categoryId is "X"
    When selectPracticeCategory is called with excludeCategoryId "X"
    Then the returned practiceCategoryId is never equal to "X"

  @REQ-025 @AC-025-2
  Scenario: A single-category pack returns the Daily category for Practice
    # TEST-044
    Given a Content Pack holding exactly 1 admitted category
    When the Practice category is selected twice
    Then the returned practiceCategoryId equals the Daily categoryId