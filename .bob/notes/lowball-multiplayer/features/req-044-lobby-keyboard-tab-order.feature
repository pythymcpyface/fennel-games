Feature: REQ-044 — Lobby keyboard Tab navigation in logical order
  As a keyboard user, I navigate the lobby in a logical order so that I can use the app without a mouse.

  @REQ-044 @AC-044-1
  Scenario: Tab key navigates lobby interactive elements in logical order
    # TEST-058
    Given the lobby page is rendered with interactive elements: display name field, room code field, join button, and start button
    When the user presses the Tab key repeatedly from the top of the page
    Then focus moves through the interactive elements in their logical visual order