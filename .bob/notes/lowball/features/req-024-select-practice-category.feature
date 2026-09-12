Feature: REQ-024 — Select the Practice category deterministically
  As the Lowball engine, I select a Practice category deterministically via FNV-1a hash.

  @REQ-024 @AC-024-1
  Scenario: Identical seed selects the same Practice category twice
    # TEST-041
    Given dayId "2026-09-10" and practice ordinal 3
    When the Practice category is selected twice
    Then both selections yield the same categoryId

  @REQ-024 @AC-024-2
  Scenario: Every Practice selection across 20 ordinals is admitted
    # TEST-042
    Given practice attempt ordinals 1 through 20 on one dayId
    When each practice category is selected
    Then every resulting categoryId exists in the admitted category set