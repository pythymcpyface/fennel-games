Feature: REQ-052 — Distinguish findable from unfindable zero-scorers in the reveal
  As the Lowball view, I render a badge whose text differs by findability for zero-scoring answers.

  @REQ-052 @AC-052-1
  Scenario: A findable zero-scoring answer's badge differs from an unfindable badge
    # TEST-087
    Given the Player's submitted answer scored 0 and has SCOWL tier 45 or better
    When the reveal screen renders
    Then the answer is labeled as "findable"

  @REQ-052 @AC-052-2
  Scenario: A non-zero-scoring answer renders no findability badge
    # TEST-088
    Given the Player's submitted answer scored 40 and has SCOWL tier 45 or better
    When the reveal screen renders
    Then the answer is labeled as "none"