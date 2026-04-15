# Missing Requirements

## Summary

No PRD was supplied to this review convoy. The hook bead (x4-leg-oyjro) and
parent molecule (x4-wisp-5zy2) render `Problem / Feature: <no value>` with no
attached PRD bead, document, or link. Sibling leg `requirements` (output at
`.prd-reviews/td6la/requirements.md` in the furiosa worktree) independently
reached the same conclusion: the convoy was poured without binding a
`problem` variable.

Because there is no artifact, every category this leg is charged with
surfacing — auth, multi-tenancy, migration, compat, edge cases, concurrency,
rate limiting, audit, i18n, a11y, mobile, admin tooling, deprecation — is
trivially "missing." The single honest finding is that the PRD itself is the
first missing requirement. Pretending otherwise would manufacture a PRD
rather than review one.

## Findings

### Critical Gaps / Questions

- **The PRD is absent.** Nothing to evaluate gaps against.
  - Why this matters: A "what hasn't been thought through" review cannot
    distinguish an unaddressed concern from an intentionally-scoped-out one
    without a scope statement. Any list we produce now is guesswork.
  - Clarifying question: "Which bead/doc/link is the PRD for convoy `td6la`?
    Please re-pour `mol-prd-review` with `--var problem=<id-or-path>` so all
    six legs share source material."

- **Convoy variable binding skipped or silently failed.**
  - Why this matters: All six legs (gaps, requirements, jeffc, sr6ng, v7nes,
    4dpju) will synthesize over empty inputs; the synthesis bead
    (x4-syn-k7s6g) still shows unrendered `{{.problem}}` and
    `{{.output.directory}}` placeholders.
  - Clarifying question: "Cancel the remaining sibling legs with
    `bd close --reason=no-input` and re-pour, or let them complete to
    document the failure mode end-to-end?"

### Important Considerations

- **Generic gaps that ALWAYS deserve explicit treatment in any PRD** — useful
  as a checklist to bring back once a PRD exists:
  - *AuthN/AuthZ*: which roles can invoke the feature; admin override path;
    service-to-service vs. user-initiated.
  - *Multi-tenancy*: per-tenant isolation, cross-tenant leakage, tenant-type
    variations (free vs. paid, self-hosted vs. managed).
  - *Data migration*: behavior for existing rows; backfill strategy;
    forward/backward-compatible schema changes.
  - *Backwards compatibility*: deprecated-API shims, client version matrix,
    feature-flag rollout plan.
  - *Empty / null / zero states*: first-run UX, no-data dashboards, pagination
    at boundary sizes (0, 1, max).
  - *Concurrency*: write-write races, idempotency keys, optimistic vs.
    pessimistic locking, at-least-once delivery semantics.
  - *Rate limiting & abuse*: per-actor quotas, burst vs. sustained,
    captcha/proof-of-work thresholds, exponential backoff contract.
  - *Audit & compliance*: which events must be logged, retention, PII
    redaction, SOC2/GDPR/HIPAA applicability.
  - *Internationalization*: translatable strings, RTL layouts, locale-aware
    numbers/dates/currencies, timezone handling in storage vs. display.
  - *Accessibility*: WCAG level target, keyboard-only flows, screen-reader
    labels, color contrast.
  - *Mobile / offline*: degraded-connectivity UX, conflict resolution on
    reconnect, push vs. pull sync.
  - *Admin tooling*: support-team debugging surface, impersonation audit,
    data-export / right-to-erasure paths.
  - *Deprecation & cleanup*: how old behavior is retired; sunset date; data
    GC once feature is unused.
  - *Observability*: SLIs/SLOs, error budgets, dashboards, alert thresholds,
    tracing coverage.
  - *Failure modes & rollback*: graceful degradation plan, feature-kill
    switch, rollback compatibility window.

- **Convoy tooling hardening.** `mol-prd-review` accepted a pour with no
  `problem` bound and rendered `<no value>` rather than refusing. A
  precondition check (`required_vars: [problem]`) on the formula would
  prevent this class of empty-convoy waste.

### Observations

- Deliverable is the report itself; no code, tests, or lint gates apply.
  Findings will be persisted to x4-leg-oyjro via `bd update --notes` before
  `gt done`.
- Recommended follow-up if a real review is intended:
  `gt pour mol-prd-review --var problem=<bead-id-or-path>` and cancel the
  current no-input legs.

## Confidence Assessment

**Low** on any substantive gap analysis (nothing to analyze). **High** on the
root-cause finding that the PRD was never bound to this convoy. The generic
checklist above is offered as scaffolding for the re-poured review, not as a
substitute for reviewing a real PRD.
