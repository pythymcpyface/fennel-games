Feature: REQ-010 — Assign the precomputed panel score to a valid answer
  As the Lowball engine, I assign the recorded panelScore to a valid answer.

  @REQ-010 @AC-010-1
  Scenario: A valid low-scoring answer is assigned its recorded panelScore of 0
    # TEST-018
    Given a category with Answer List containing "hiccough"
    When the Player submits "hiccough"
    Then the sweep's panelScore is set to 0

  @REQ-010 @AC-010-2
  Scenario: A valid answer is assigned its recorded panelScore of 100
    # TEST-019
    Given a category with Answer List containing "through"
    When the Player submits "through"
    Then the sweep's panelScore is set to 100