Feature: REQ-034 — Admit only categories holding a findable zero-scoring answer
  As the Build Tool, I exclude candidate categories lacking a findable zero-scoring answer.

  @REQ-034 @AC-034-1
  Scenario: A candidate whose zero-scorers are all unfindable is excluded
    # TEST-059
    Given a candidate category whose only zero-scorers sit at tier 70
    When the Fairness Gate evaluates the category
    Then the category is excluded

  @REQ-034 @AC-034-2
  Scenario: A candidate with one findable zero-scorer at tier 50 is admitted
    # TEST-060
    Given a candidate category with 1 zero-scorer at tier 50
    When the Fairness Gate evaluates the category
    Then the category is admitted to the Content Pack