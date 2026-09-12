Feature: REQ-043 — Countdown has aria-live region
  As a screen reader user, I hear countdown updates so that I know how much time remains.

  @REQ-043 @AC-043-1
  Scenario: Countdown element is marked as an aria-live region
    # TEST-057
    Given the sweep countdown component is rendered
    When the countdown element is inspected
    Then the countdown element has an "aria-live" attribute set to "polite" or "assertive"