Feature: REQ-040 — workers/lowball-relay/wrangler.toml present and valid
  As a maintainer, I have a valid wrangler configuration so that the Worker deploys correctly.

  @REQ-040 @AC-040-1
  Scenario: wrangler.toml file exists and parses as valid TOML
    # TEST-054
    Given the repository root exists
    When the file "workers/lowball-relay/wrangler.toml" is read
    Then the file exists
    And the file content parses as valid TOML