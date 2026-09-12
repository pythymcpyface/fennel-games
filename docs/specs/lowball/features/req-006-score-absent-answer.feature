Feature: REQ-006 — Score an answer absent from the Answer List as the maximum penalty
  As the Lowball engine, I penalise answers not present in the Answer List.

  @REQ-006 @AC-006-1
  Scenario: An answer absent from the Answer List scores 100
    # TEST-010
    Given a category with Answer List containing "though"
    When the Player submits "zzzzqqq"
    Then the sweep's panelScore is set to 100

  @REQ-006 @AC-006-2
  Scenario: An absent-answer submission returns state without throwing
    # TEST-011
    Given a category with Answer List containing "though"
    When the Player submits "zzzzqqq"
    Then a state object is returned and no exception is raised