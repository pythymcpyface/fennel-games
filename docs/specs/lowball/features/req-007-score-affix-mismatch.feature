Feature: REQ-007 — Score an answer failing the affix pattern as the maximum penalty
  As the Lowball engine, I penalise answers that do not satisfy the round's affix.

  @REQ-007 @AC-007-1
  Scenario: A real word failing the suffix pattern scores 100
    # TEST-012
    Given a category with Answer List containing "though"
    When the Player submits "table"
    Then the sweep's panelScore is set to 100

  @REQ-007 @AC-007-2
  Scenario: A submission failing the prefix pattern scores 100
    # TEST-013
    Given a category with Answer List containing "though"
    When the Player submits "postpone"
    Then the sweep's panelScore is set to 100