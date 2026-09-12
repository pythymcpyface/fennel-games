Feature: REQ-056 — Keep the engine free of platform effects
  As the Lowball engine module, I import no storage, clock or document interface.

  @REQ-056 @AC-056-1
  Scenario: The engine module imports no forbidden platform interface
    # TEST-095
    Given the Lowball engine module source
    When its import statements are inspected
    Then no import specifier references a storage, clock or document interface

  @REQ-056 @AC-056-2
  Scenario: Repeated submission transitions with identical arguments are deep-equal
    # TEST-096
    Given a submission transition and a fixed argument set
    When the transition is invoked twice with those same arguments
    Then both returned states are deep-equal