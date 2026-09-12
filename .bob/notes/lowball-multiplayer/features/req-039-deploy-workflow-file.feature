Feature: REQ-039 — .github/workflows/deploy-pages.yml present and valid YAML
  As a maintainer, I have a valid deployment workflow so that CI/CD functions correctly.

  @REQ-039 @AC-039-1
  Scenario: Deployment workflow file exists and parses as valid YAML
    # TEST-052, TEST-053
    Given the repository root exists
    When the file ".github/workflows/deploy-pages.yml" is read
    Then the file exists
    And the file content parses as valid YAML