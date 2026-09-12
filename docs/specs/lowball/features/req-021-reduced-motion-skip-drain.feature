Feature: REQ-021 — Skip the drain under reduced motion
  As the Lowball engine, I set tickCounter directly to the target score when reducedMotion is true.

  @REQ-021 @AC-021-1
  Scenario: tickCounter is set directly to the target score under reduced motion
    # TEST-036
    Given reducedMotion is true
    And a sweep that has just been scored 33
    When the sweep score is assigned
    Then tickCounter equals 33

  @REQ-021 @AC-021-2
  Scenario: tickCounter never passes through 100 under reduced motion
    # TEST-037
    Given reducedMotion is true
    And a sweep that has just been scored 33
    When the sweep score is assigned
    Then tickCounter never holds the value 100 in the returned state