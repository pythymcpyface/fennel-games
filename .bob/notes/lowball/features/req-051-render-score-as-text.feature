Feature: REQ-051 — Render the score as text alongside the bar column
  As the Lowball view, I render the numeric panelScore as text whenever the Tension Counter is displayed.

  @REQ-051 @AC-051-1
  Scenario: The Tension Counter displays the numeric score as text
    # TEST-086
    Given a Tension Counter displaying a score of 42
    When the rendered view text is queried
    Then the numeric score appears as text