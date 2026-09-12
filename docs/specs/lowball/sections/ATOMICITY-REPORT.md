# Atomicity Report — lowball

**Complexity class:** small
**Refinement passes:** 2 (fixed point reached)
**Verdict:** PASS

## Inputs

| Source | REQs | Note |
|---|---|---|
| AAS supervisor Phase 1 | REQ-001..REQ-003 | Emitted complete |
| AAS supervisor Phase 1 | REQ-004 | **Truncated mid-definition** — supervisor output cut at `- **ID:` |
| Local Phase 3 | REQ-004..REQ-056 | Authored to close RISK-003 and resolve Proposed ADRs |

## Rule results

| Rule set | Checked | Violations |
|---|---|---|
| A1–A8 structural atomicity | 56 REQs | 0 |
| V1–V10 vague-word lint | 56 EARS statements | 0 |
| S1–S6 schema completeness (20 fields each) | 1120 field slots | 0 |
| AC uniqueness | 96 TEST ids | 0 duplicates |
| Blocking open questions | 56 REQs | 0 |

## Sizing floors (class: small)

| Metric | Floor | Actual | Result |
|---|---|---|---|
| Journeys | 6 | 4 | **WAIVER REQUESTED** (see below) |
| Requirements | 25 | 56 | PASS |
| Acceptance criteria | 50 | 96 | PASS |
| Scenarios | 50 | 96 (1:1 with ACs) | PASS |

### UNDERSIZE-WAIVER — journeys

The supervisor emitted 4 journeys against a floor of 6. The four cover every actor in the
role matrix (Player daily, Player practice, Build Tool, Player reveal/share) and every entry
point ENTRY-001..ENTRY-005. Journeys 1 and 2 each carry their own branch, error, loop-back and
edge-case sets (JOURNEY-001 alone has 3 branches, 5 error states, 2 loop-backs and 8 edge
cases). Splitting them further would fragment a single continuous player flow without adding
coverage. Requirement and AC counts exceed their floors by 124% and 92% respectively.

**Waiver status:** requires user approval before overall PASS.

## Fixed-point trace

| Pass | REQ count | Violations | Action |
|---|---|---|---|
| 1 | 56 | 0 | Authored REQ-004..REQ-056; linted clean |
| 2 | 56 | 0 | Count and violations stable — fixed point reached |

## Risk closure

| Risk | Severity | Closed by |
|---|---|---|
| RISK-001 | Critical | REQ-042 (par > 0 gate rule) |
| RISK-003 | Critical | REQ-004..REQ-056 (full REQ set authored) |
| RISK-004 | High | REQ-022, REQ-023 (byte-identical snapshot assertions) |
| RISK-007 | Medium | REQ-004 (hash maps only into admitted set; 3650-day fuzz) |
| RISK-008 | Medium | REQ-030 (idempotent stats reconciliation) |
| RISK-010 | Medium | REQ-024 (named practice seed), REQ-025 (collision advance) |
| RISK-011 | Medium | REQ-029 (single migration signature) |
| RISK-012 | Low | REQ-045 (200 KiB CI ceiling) |

## ADR closure

| ADR | Prior status | Now |
|---|---|---|
| ADR-006 Practice history retention | Proposed | Accepted via REQ-026 (single slot) |
| ADR-007 Par value of 0 | Proposed | Accepted via REQ-042 (exclude par 0) |
| ADR-008 Practice share labelling | Proposed | Accepted via REQ-048 ("(Practice)" marker) |

## Still open

| Item | Owner | Note |
|---|---|---|
| RISK-002 Answer List is sole validator | Build Tool owner | Mitigation is a secondary-wordlist lint; no REQ authored — accepted as documented residual risk for v1 |
| RISK-005 Multi pack-version coexistence | Architect | Dangling ADR cross-reference; deferred to /start-project architecture phase |
| RISK-006 GloVe provenance and checksum | DevOps | Build-setup documentation task, not a product requirement |
