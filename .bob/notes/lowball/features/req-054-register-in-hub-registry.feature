Feature: REQ-054 — Register the game in the hub registry
  As the Hub Shell, I include the Lowball plugin in the ordered game list exactly once.

  Background:
    Given the hub registry is loaded at boot

  @REQ-054 @AC-054-1
  Scenario: The registry contains exactly one Lowball entry
    # TEST-091
    When the registry entries are enumerated
    Then one entry carries the identifier "lowball"

  @REQ-054 @AC-054-2
  Scenario: No registry identifier appears twice
    # TEST-092
    When the registry entries are enumerated
    Then no identifier appears twice