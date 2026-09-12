Feature: REQ-004 — Constrain category selection to the admitted category set
  As the Lowball engine, I map the selection hash into the admitted category set only.

  @REQ-004 @AC-004-1
  Scenario: Every mapped categoryId across 3650 consecutive days is admitted
    # TEST-006
    Given 3650 consecutive dayId values
    When each dayId is mapped to a categoryId
    Then every resulting categoryId exists in the admitted category set

  @REQ-004 @AC-004-2
  Scenario: A pack with zero admitted categories returns PackUnavailable instead of throwing
    # TEST-007
    Given a Content Pack declaring an admitted category count of 0
    When category selection is attempted
    Then a PackUnavailable result is returned without throwing