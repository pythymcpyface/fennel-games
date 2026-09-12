Feature: REQ-018 — Initialise the tick counter at 100
  As the Lowball engine, I set tickCounter to 100 when a Sweep score is assigned.

  @REQ-018 @AC-018-1
  Scenario: tickCounter initialises to 100 after a sweep is scored
    # TEST-032
    Given a sweep that has just been scored 40
    When the sweep score is assigned
    Then tickCounter equals 100