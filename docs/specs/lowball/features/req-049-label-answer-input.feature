Feature: REQ-049 — Label the answer input for assistive technology
  As the Lowball view, I assign the answer input an accessible name naming the current category.

  @REQ-049 @AC-049-1
  Scenario: The answer input exposes a non-empty accessible name
    # TEST-084
    Given a rendered round view
    When the accessible name of the answer input is queried
    Then the accessible name is a non-empty string