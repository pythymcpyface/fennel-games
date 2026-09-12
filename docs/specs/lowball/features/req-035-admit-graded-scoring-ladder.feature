Feature: REQ-035 — Admit only categories holding a graded scoring ladder
  As the Build Tool, I exclude candidate categories whose non-zero scores lack enough spread.

  @REQ-035 @AC-035-1
  Scenario: A candidate with only 4 non-zero answers is excluded
    # TEST-061
    Given a candidate category with 4 non-zero answers spanning 4 distinct score values
    When the Fairness Gate evaluates the category
    Then the category is excluded

  @REQ-035 @AC-035-2
  Scenario: A candidate with 6 non-zero answers but only 3 distinct values is excluded
    # TEST-062
    Given a candidate category with 6 non-zero answers spanning 3 distinct score values
    When the Fairness Gate evaluates the category
    Then the category is excluded