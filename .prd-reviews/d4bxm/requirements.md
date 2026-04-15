# Requirements Completeness

## Summary

The PRD is strong on *framing* — problem, non-goals, phased approach, and the
"research-before-decide" discipline are all clearly stated. It is substantially
weaker on *verifiable acceptance criteria*. The five Goals read like research
deliverables, but none of them carry a concrete pass/fail bar: "ground truth on
root cause", "full inventory", "decision framework", "regression guard",
"implementation-ready plan" are all quality labels, not tests. A QA engineer
handed this PRD could not independently say whether the work is done — they
would have to ask the author. That is the central gap.

The PRD also treats this as a pure research task, but the *output* (Phase C)
lands production code changes (esbuild target, template regen, CI gate). The
non-functional requirements, rollback plan, and observability story for that
production change are not specified. Happy-path coverage is good;
failure-mode coverage is almost entirely absent.

## Findings

### Critical Gaps / Questions

- **No verifiable success metric for the fix itself.**
  Goals 1–5 describe research deliverables; none say what "paywall works with
  MetaMask" means in testable terms. Is the bar "renders without console
  error"? "Completes a full payment on a test chain"? "Passes a scripted
  repro in CI"? Without this, Phase C has no exit condition.
  - *Why this matters:* the whole PRD is justified by "fix the breakage", but
    "fixed" is not defined. Two engineers could disagree on whether the work
    is done.
  - *Ask:* "What is the single observable signal that tells us the paywall is
    fixed for MetaMask users? Console-clean render? End-to-end payment on a
    testnet? A green CI repro?"

- **No browser / wallet version matrix.**
  "MetaMask-using end users" is named, but no MetaMask version, no browser
  version, no OS. SES behavior depends on the `@endo/ses` version that
  MetaMask ships, which varies by release channel. Without a pinned matrix
  the diagnostic repro (Phase A.1) is not reproducible by another engineer —
  which violates the "Reproducibility" constraint the PRD itself states.
  - *Why this matters:* Phase A.4 ("check `@endo/ses` docs/source for the
    version MetaMask ships") has no anchor version to check against.
  - *Ask:* "Which MetaMask version(s) must the fix demonstrably work on? Is
    there a minimum version we're willing to drop (e.g., MetaMask < Xx.yy
    deferred to a later sweep)?"

- **"Regression guard" is named as a goal but not specified.**
  Goal 4 says "CI-enforceable check". Phase C.2 lists two candidate checks
  (rebuild-and-diff, syntax lint against SES-supported set) but presents them
  as a menu, not a decision. Open Question #7 asks "what does the guard look
  like?" but does not gate the PRD on answering it. The "implementation-ready
  plan" (Goal 5) cannot be implementation-ready if the guard design is TBD.
  - *Why this matters:* without a concrete guard design, the polecat landing
    Phase C has to make the design call unilaterally, which defeats the
    research-first discipline.
  - *Ask:* "Is the guard design an output of Phase A/B (decided from
    evidence), or is it prescribed up front? If prescribed, which variant?"

- **Missing "minimum supported ES target" constraint.**
  Goal 2 demands a full ES2020+ syntax inventory, and Option 1 considers
  "esbuild target downgrade (to es2019 or lower, depending on inventory)".
  But there is no stated floor. How low are we willing to go? es2017?
  es2015? This is the central trade-off in Option 1 and it is left entirely
  to the polecat.
  - *Why this matters:* a target downgrade without a stated floor can slide
    all the way to es5, blowing up bundle size and perf for no gain.
  - *Ask:* "What is the lowest ES target you will accept? Is there a
    bundle-size or runtime-perf ceiling we must stay under?"

- **No rollback or recovery plan.**
  Phase C lands a target downgrade + template regen + CI gate in a combined
  PR. If this regresses non-MetaMask users (e.g., mobile Safari perf, bundle
  size over an unrelated budget, a new test in some seller's CI), the PRD
  does not say how to revert. No feature flag, no staged rollout, no revert
  procedure.
  - *Why this matters:* this ships to every seller using `@x402/paywall`.
    The blast radius is larger than the targeted MetaMask fix.
  - *Ask:* "What is the rollback path if this fix breaks a different
    audience in production? Do we need a flag, a pre-release, or is a fast
    revert acceptable?"

- **No observability / error-signal plan.**
  The failure the PRD is fixing was noticed by users, not by us. Nothing in
  the PRD says we will gain the ability to detect a recurrence ourselves.
  Monitoring, alerting, sentry/error-report integration — all absent. Goal 4
  covers *build-time* regression but not *runtime* regression.
  - *Why this matters:* if a future `@endo/ses` version rejects some *other*
    syntax we didn't anticipate, the CI guard won't catch it. We need a
    runtime signal.
  - *Ask:* "Does the paywall currently report client-side script-parse
    failures back to us? If not, should adding that reporting be in scope
    here or a separate bead?"

### Important Considerations

- **"Non-trivial slice" is undefined.**
  The Constraints section says "cannot silently drop support for a
  non-trivial slice of current paywall users". "Non-trivial" is not a
  testable threshold. 1%? 5%? 0.1%? This directly blocks Option 1's
  evaluation — you cannot score "audience impact" without a bar. Tie this to
  a number, or explicitly state that the number will be produced by Phase
  A.5 (audience data).

- **Ambiguous definition of "implementation-ready plan" (Goal 5).**
  No checklist for what makes a plan bead implementation-ready. Candidate
  items: chosen option, concrete commit-level task breakdown, named files
  touched, CI gate design, test plan, rollback plan. Without this the
  downstream crew-fox work cannot be scoped.

- **Phase A has no branch-point for a failed repro.**
  Phase A.1 assumes the failure reproduces in a controlled environment. What
  if it doesn't? What if the failure is version-specific or timing-dependent
  and the polecat can't recreate it? PRD has no guidance for "ground truth
  unreachable" — which is a real possibility given the open questions about
  wallet/browser/OS matrix.

- **Phase A.5 allows "decide to skip" audience data.**
  Skipping is explicitly allowed, but the consequences are not traced
  through. If we skip, Option 1's "audience impact" score is a guess. The
  PRD should either require the data or require Option 1 to be scored with
  a conservative (lowest reasonable) target when data is absent.

- **"Security posture: fix must not weaken" lacks a baseline.**
  No pointer to the current security model document. Options 2 (externalize)
  has explicit security impact per the PRD, but there is no baseline to
  compare against. A "does-not-weaken" criterion without a reference is
  untestable.

- **Three artifacts ship (TS, Go, Python); guard scope is open.**
  Open Question #8 correctly identifies this but doesn't resolve it.
  Depending on the answer, Phase C.2's CI gate is 1 check or 3. This is a
  material sizing question.

- **Goal 3 lists 3–4 options but defines no completeness criterion for the
  option set.**
  "Option 4: anything else surfaced by the research" leaves the bar open.
  How does the reviewer know the set is complete? Suggest: the set is
  complete if no option differs from the listed ones on *audience*,
  *security*, *deployment*, or *maintenance* dimensions.

### Observations

- **Phase gating is implicit.**
  Phase A → Phase B → Phase C is a sequence, but the PRD doesn't say Phase B
  is blocked on a complete Phase A, or that Phase C is blocked on a chosen
  Phase B option. This is probably intended but should be explicit so the
  polecat doesn't start Phase C from a hunch.

- **"Bundle one combined PR" is an acceptable-default, but the split
  criterion is unstated.**
  "Unless review surfaces a reason to split" — what would that reason look
  like? Reviewer cares about diff size? Reviewer cares about being able to
  revert just one piece? Make the split trigger explicit.

- **Timeline pressure is flagged but unanswered.**
  Open Question #9 asks "is there a hard release date". Requirements
  completeness depends on this: under a hard date, gaps can be accepted as
  known risks; under a soft date, they should be closed before work starts.

- **Open Question #10 (mezo/fox workaround) is load-bearing but optional.**
  If Mezo is already working around this, their workaround may be the
  cheapest fix or may inform the inventory. Flagging as "should be answered
  in Phase A" rather than left open.

- **"Seller bumps `@x402/paywall`" user story (scenario 2) implies a
  versioning contract.**
  Does this fix warrant a semver-minor, semver-patch, or major? The PRD
  doesn't say. For sellers, this matters for automated upgrade policies.

## Confidence Assessment

**Medium-Low.** The PRD's research framing is well-specified — a competent
polecat could execute Phase A and produce a useful inventory and repro. But
Phase C (the actual fix) is under-specified in ways that will force the
downstream implementer to make requirements decisions that should be the
author's: success metric, browser/wallet matrix, ES target floor, rollback
plan, observability, versioning. For a "research to surface evidence" scope
this PRD is acceptable; for a PRD whose Goal 5 is "implementation-ready
plan", the acceptance conditions for that plan are themselves missing. Close
the six Critical Gaps before letting Phase C start.
