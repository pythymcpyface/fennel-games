Feature: REQ-046 — Fail the content build below the minimum admitted category count
  As the Build Tool, I terminate the build when fewer than 120 categories pass the Fairness Gate.

  @REQ-046 @AC-046-1
  Scenario: Admitting 119 categories exits the build with a non-zero status
    # TEST-078
    Given a Fairness Gate run admitting 119 categories
    When the admitted category count is checked
    Then the build exits with a non-zero status

  @REQ-046 @AC-046-2
  Scenario: The shipped pack admits at least 120 categories
    # TEST-079
    Given a fully built Content Pack for the current version
    When the admitted category count is checked
    Then the admitted category count is at least 120