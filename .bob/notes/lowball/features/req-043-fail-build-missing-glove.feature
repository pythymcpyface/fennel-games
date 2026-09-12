Feature: REQ-043 — Fail the content build when GloVe vectors are missing
  As the Build Tool, I terminate the build with a clear error when GloVe vectors are unreadable.

  Background:
    Given the vendored GloVe 6B 50d file is absent from the filesystem

  @REQ-043 @AC-043-1
  Scenario: A missing GloVe file exits the build with a non-zero status
    # TEST-073
    When the build tool is invoked
    Then the build exits with a non-zero status

  @REQ-043 @AC-043-2
  Scenario: A missing GloVe file names the expected path in the error message
    # TEST-074
    When the build tool is invoked
    Then the emitted message contains the expected GloVe file path