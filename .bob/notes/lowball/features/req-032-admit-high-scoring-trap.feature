Feature: REQ-032 — Admit only categories holding a high-scoring trap answer
  As the Build Tool, I exclude candidate categories whose top score is below 45.

  @REQ-032 @AC-032-1
  Scenario: A candidate whose top score is exactly 45 is admitted
    # TEST-055
    Given a candidate category whose top answer scores 45
    When the Fairness Gate evaluates the category
    Then the category is admitted to the Content Pack

  @REQ-032 @AC-032-2
  Scenario: A candidate whose top score is 44 is excluded
    # TEST-056
    Given a candidate category whose top answer scores 44
    When the Fairness Gate evaluates the category
    Then the category is excluded