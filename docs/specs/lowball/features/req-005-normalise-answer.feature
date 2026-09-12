Feature: REQ-005 — Normalise a submitted answer before lookup
  As the Lowball engine, I normalise submissions so lookup is consistent.

  @REQ-005 @AC-005-1
  Scenario: Raw submission is normalised to NFC, trimmed, lowercased and stripped
    # TEST-008
    Given the raw submission "  ThOuGh  "
    When the submission is normalised
    Then the normalised result equals "though"

  @REQ-005 @AC-005-2
  Scenario: Normalisation is idempotent
    # TEST-009
    Given an already-normalised string
    When normalisation is applied a second time
    Then the result is unchanged