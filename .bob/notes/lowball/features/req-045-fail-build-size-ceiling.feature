Feature: REQ-045 — Fail the content build when the pack exceeds its size ceiling
  As the Build Tool, I terminate the build when the serialised pack exceeds 200 KiB.

  @REQ-045 @AC-045-1
  Scenario: A pack of 201 KiB exits the build with a non-zero status
    # TEST-076
    Given a serialised Content Pack of 201 kibibytes
    When the size ceiling is checked
    Then the build exits with a non-zero status

  @REQ-045 @AC-045-2
  Scenario: The shipped pack does not exceed the size ceiling
    # TEST-077
    Given a fully built Content Pack for the current version
    When its serialized size is measured
    Then it does not exceed 200 KB