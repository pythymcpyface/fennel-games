Feature: REQ-042 — Exclude categories whose par is zero
  As the Build Tool, I exclude candidate categories whose computed parValue is zero.

  @REQ-042 @AC-042-1
  Scenario: A candidate yielding parValue 0 is excluded
    # TEST-071
    Given a candidate category yielding a parValue of 0
    When the Fairness Gate evaluates the category
    Then the category is excluded

  @REQ-042 @AC-042-2
  Scenario: Every admitted category in the shipped pack has a positive parValue
    # TEST-072
    Given a fully built Content Pack for the current version
    When every admitted category is inspected
    Then each parValue is greater than 0