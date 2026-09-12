Feature: REQ-053 — Disclose the simulated origin of the panel score
  As the Lowball view, I disclose that the panel is simulated wherever a panel score is presented.

  @REQ-053 @AC-053-1
  Scenario: The rendered view discloses the simulated panel origin
    # TEST-089
    Given a rendered round view
    When the round view is rendered for the disclosure check
    Then the rendered view text contains "simulated panel of 100"

  @REQ-053 @AC-053-2
  Scenario: The rendered view omits the misleading real-panel phrasing
    # TEST-090
    Given a rendered round view
    When the round view is rendered for the disclosure check
    Then the rendered view text omits "we asked 100 people"