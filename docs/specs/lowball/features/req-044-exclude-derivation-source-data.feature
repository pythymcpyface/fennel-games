Feature: REQ-044 — Exclude derivation source data from the Content Pack
  As the Build Tool, I exclude GloVe vectors and raw SCOWL tier listings from the serialised pack.

  @REQ-044 @AC-044-1
  Scenario: The serialised Content Pack contains no vector arrays
    # TEST-075
    Given a fully built Content Pack for the current version
    When the Content Pack keys are enumerated
    Then no key holds a vector array