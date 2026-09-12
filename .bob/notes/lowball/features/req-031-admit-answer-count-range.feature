Feature: REQ-031 — Admit only categories holding 10 to 36 valid answers
  As the Build Tool, I exclude candidate categories outside the 10-36 valid-answer range.

  @REQ-031 @AC-031-1
  Scenario: A candidate with exactly 10 answers is admitted
    # TEST-053
    Given a candidate category with 10 valid answers
    When the Fairness Gate evaluates the category
    Then the category is admitted to the Content Pack

  @REQ-031 @AC-031-2
  Scenario: A candidate with 37 answers is excluded
    # TEST-054
    Given a candidate category with 37 valid answers
    When the Fairness Gate evaluates the category
    Then the category is excluded