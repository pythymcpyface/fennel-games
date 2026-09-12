Feature: REQ-033 — Admit only categories holding six findable answers
  As the Build Tool, I exclude candidate categories with fewer than six findable answers.

  @REQ-033 @AC-033-1
  Scenario: A candidate with exactly 6 findable answers is admitted
    # TEST-057
    Given a candidate category with 6 findable answers at tier 50 or better
    When the Fairness Gate evaluates the category
    Then the category is admitted to the Content Pack

  @REQ-033 @AC-033-2
  Scenario: A candidate with 5 findable answers is excluded
    # TEST-058
    Given a candidate category with 5 findable answers at tier 50 or better
    When the Fairness Gate evaluates the category
    Then the category is excluded