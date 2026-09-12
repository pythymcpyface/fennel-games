Feature: REQ-061 — Lobby interactive elements have aria-label or label
  As a screen reader user, I understand the purpose of each lobby control so that I can operate the interface.

  @REQ-061 @AC-061-1
  Scenario: All lobby interactive elements have an accessible label
    # TEST-076
    Given the lobby page is rendered with interactive elements: display name field, room code field, join button, and start button
    When each interactive element is inspected for accessibility attributes
    Then each interactive element has either an "aria-label" attribute or an associated "<label>" element