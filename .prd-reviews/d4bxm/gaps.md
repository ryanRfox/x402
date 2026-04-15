# Missing Requirements

## Summary

The PRD is strong on diagnosis and option-framing, but thin on everything that
happens around the fix: production telemetry, rollout/rollback mechanics,
downstream communication, cross-artifact scope, and the concrete definition of
"safe syntax" that the guard is supposed to enforce. Because the fix targets a
client-side parse error in a majority-traffic code path, several unaddressed
operational scenarios (CDN outage if externalized, silent regression after a
future viem bump, blind spots in the three-language artifact chain) could
themselves cause the same kind of incident this work is supposed to prevent.

The PRD also does not define a success metric, a rollback trigger, or the
SES/MetaMask version matrix that the fix is committing to support — three gaps
that together make it hard to say when this work is "done" or when it has
silently started failing again.

## Findings

### Critical Gaps / Questions

- **No production telemetry requirement.** The PRD never requires
  instrumentation to detect that the paywall actually parses/loads on an
  end-user page. Today we only know about the bug because humans reported it.
  After the fix, we would have the same blind spot.
  - *Why it matters:* without an error/"paywall rendered" beacon, any future
    regression (from a viem bump, esbuild version drift, a new wallet shipping
    SES, etc.) will again be discovered by users, not alerts.
  - *Suggested question:* Is adding a lightweight `paywall_bootstrap_ok` /
    `paywall_bootstrap_failed` metric (or Sentry-style error report from a
    top-level `try`) in scope for this work, or a follow-up? If follow-up, what
    is the interim signal we rely on?

- **No defined SES/MetaMask support matrix.** Goals 1–2 require knowing which
  SES versions we must parse under, but the PRD never pins the set. "MetaMask
  current" is a moving target; "any SES-using wallet" is unbounded.
  - *Why it matters:* the guard in Phase C claims to "lint against the
    SES-supported syntax set" — but that set is undefined. Without a pinned
    version list, the guard encodes an implicit assumption that can silently
    drift.
  - *Suggested question:* Can we commit to an explicit list (e.g., "MetaMask
    extension ≥ X.Y, MetaMask Mobile ≥ A.B, Rabby ≥ C, Rainbow ≥ D") and
    treat anything outside that list as best-effort?

- **Scope of cross-language artifacts is flagged as an open question but left
  unresolved in requirements.** Open Question #8 notes TS/Go/Python all ship
  generated artifacts, but the PRD's Phase C guard is written only against the
  TS template. If the Go/Python generators lag, a seller using the Go SDK could
  still ship a broken bundle even after this work "lands."
  - *Why it matters:* decides whether this is one fix or three, and whether
    CI must gate PRs that touch the generators.
  - *Suggested question:* Are the Go and Python artifacts pure mirrors of the
    TS bake output (generated in the same CI step), or can they drift? If they
    can drift, the guard must cover all three.

- **No rollback plan.** The PRD assumes the fix lands and is correct. It does
  not define what happens if the downgraded-target build breaks a different
  slice of users, or if the externalized-script CDN has issues at launch.
  - *Why it matters:* this change is shipped to sellers; sellers are the ones
    who see any regression. Revert-by-npm-unpublish is slow and noisy.
  - *Suggested question:* What is the rollback trigger and mechanism? Do we
    ship the fix behind a template version that sellers can pin back?

- **No success criteria / exit metric.** "Fixed" is not defined numerically or
  observationally. The PRD's Goals are process goals (ground truth, inventory,
  decision framework, guard, plan) — none are "paywall bootstrap error rate
  drops to < X% in production."
  - *Why it matters:* without a measurable exit, we can't tell Refinery /
    witness when this is safe to close, and we can't tell the mayor whether
    a future regression has landed.
  - *Suggested question:* What does "this work succeeded" look like in data?

### Important Considerations

- **Externalized-script path has unspecified security & integrity
  requirements.** The Option 2 branch in Phase B would turn the paywall into a
  CDN asset. The PRD names "CSP, inline-vs-external, no eval" as constraints
  but does not require: SRI (subresource integrity), a named CDN, a cache
  policy, or a fallback if the CDN is unreachable. It also does not address
  sellers whose host-page CSP does not allow third-party script sources.
  - *Why it matters:* quietly turning every seller's paywall into a
    cross-origin load is a real deployment-model change even if the PRD says
    "not a platform shift."

- **No backport / old-version policy.** User Story #2 describes sellers who
  *upgrade* to the post-viem-bump release. The PRD is silent on sellers pinned
  to `@x402/paywall` versions that are already in the wild and already broken.
  - *Why it matters:* those sellers are the ones the problem statement calls
    out ("breakage is already in production"). Not addressing them leaves
    the stated impact unresolved for the existing install base.
  - *Suggested question:* Do we backport the fix to the last 1-2 minor
    versions, or do we push sellers onto the new release via communication
    only?

- **No seller-facing communication plan.** Release notes, changelog entry,
  migration guidance, and "you are affected if…" triage doc are not mentioned.
  Support teams will be fielding questions from sellers who don't know whether
  they are affected.

- **No E2E test requirement under a locked-down SES environment.** The Phase C
  guard is a static lint of the baked artifact. It does not require a runtime
  test that actually loads the paywall in a browser with SES `lockdown()`
  applied. A static syntax allow-list can pass while runtime still fails for a
  reason the allow-list didn't model (e.g., a bundled-in dependency that calls
  `Function()` at runtime, which SES blocks independently of parser syntax).

- **Admin / support tooling gap.** No mention of how an x402 on-call
  responds when a seller reports "my paywall is blank." The current signal is
  a console error; the PRD does not require a readable surfacing of that error
  to the end user or an operator dashboard that counts occurrences.

- **"When is it safe to raise the target again" is not defined.** Goal is a
  target downgrade (potentially), but the PRD has no re-raise criteria. Future
  engineers will inherit an esbuild `target: es2019` with no note on what would
  have to change upstream to revisit.
  - *Suggested question:* Capture the re-raise trigger as part of the plan
    bead (e.g., "raise target when MetaMask majority-weighted-by-usage ships
    `@endo/ses` ≥ version Y").

- **MetaMask Mobile and in-app browsers not explicitly in scope.** The PRD
  references MetaMask (extension) and other SES-using wallets generically.
  In-app dapp browsers (MetaMask Mobile, Coinbase Wallet, Rainbow, Trust) have
  their own script parsers and SES versions. Whether the fix must work under
  those is unspecified.

- **No requirement for an upstream bug report.** Even though "not fixing
  MetaMask" is explicitly a non-goal, there is no requirement to file an issue
  with `@endo/ses` and/or MetaMask so that (a) the incompatibility is
  documented for the ecosystem, and (b) a future upstream fix can be tracked
  against our re-raise trigger.

### Observations

- **"Majority of EVM paywall traffic" is asserted but not sourced.** Open
  Question #4 correctly flags that we may not have audience data. The Problem
  Statement's severity framing should be treated as a hypothesis until that
  data exists — currently the severity is the engineer's estimate, not a
  measured number.

- **Accessibility of the failure mode is unexamined.** Today the failure is a
  blank page — there is no user-visible message, no fallback UI, no guidance.
  The PRD scopes the fix to making the paywall render correctly, which is
  right, but the degraded-state UX for any *future* compatibility break is
  worth a line item.

- **Concurrent-wallet injection not considered.** A user with MetaMask *and*
  another SES-using wallet installed may hit a different injection order or
  lockdown configuration. Probably low-frequency but worth explicit
  acknowledgement in the reproduction step.

- **The "one combined PR" convention** (x4-v12 regen + x4-1po fix + guard) is
  called out as acceptable, but nothing in the PRD specifies how a reviewer
  separates the regen-noise diff from the fix diff during code review. A note
  on commit structure (or splitting-back-out criteria) would save reviewer
  cycles.

- **No mention of whether this change requires a major/minor/patch bump of
  `@x402/paywall`.** Semver choice affects seller upgrade behavior and whether
  automatic dependency bots pick it up.

- **x4-v12 dependency framing.** PRD notes x4-v12 is "sequenced before this"
  and "cooked first on the same branch." What happens if x4-v12 stalls or is
  rejected — does this work proceed independently, or is it blocked? Not
  specified.

## Confidence Assessment

**Medium.** The PRD is thorough on the *technical* dimension (root-cause
investigation, syntactic inventory, option comparison, regression guard) and
that work is mostly well-scoped. The gaps cluster in the *operational*
dimension: telemetry, rollout, rollback, support, success metrics, and
cross-artifact scope. These are the areas most likely to cause a repeat
incident even after this PRD's work ships. The good news is that several of
these gaps can be addressed with a single "Rollout & Operations" section
added to the plan bead rather than additional research rounds.
