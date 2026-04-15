# Requirements Completeness

## Summary

The PRD is well-structured around diagnosis and decision-making but is
under-specified on *what "done" looks like when the work lands*. Goal 1
("Mezo works end-to-end") sounds testable but lacks a concrete pass/fail
recipe: which network, which wallet, which amount, what on-chain confirmation
counts as success, and whether Go/Python mirrors are in-scope for v0.11.0 or
only TypeScript. Goals 3–5 are research/handoff outcomes with subjective
acceptance gates ("understand", "define", "Ryan reviews") and no rubric,
which makes it hard for a polecat or QA engineer to know when Phase A or
Phase C is complete.

The biggest gaps are around failure modes and post-release verification:
the PRD has no rollback plan, no non-regression requirement for the other
chains bundled into the regenerated template, no observability/alerting
story for catching a future staleness in the wild, and no detection-latency
or coverage target for the "recurrence guard" that is Goal 4's deliverable.
Several open questions (especially #10, the x4-v12 interaction) are
scope-affecting and should be resolved before Phase A starts, not
discovered during it.

## Findings

### Critical Gaps / Questions

- **Goal 1 lacks a verifiable definition of "works end-to-end."**
  - *Why this matters:* "Renders the payment flow without 'Unsupported
    chain ID' errors" could mean (a) the page loads, (b) the wallet connects,
    (c) the transaction is signed, (d) the transaction is confirmed on
    chain, or (e) the downstream paywalled resource is actually served.
    Different choices imply radically different test harnesses and
    different risk of false-positive "fixed" claims.
  - *Suggested clarifying question:* "For v0.11.0 acceptance, what
    specifically must happen on Ryan's machine with a Mezo-connected
    wallet — render only, signed transaction, confirmed transaction, or
    full paid-resource fetch? Testnet or mainnet? What minimum transfer
    amount?"

- **Scope of the three mirrored templates (TS / Go / Python) for v0.11.0
  is unclear.**
  - *Why this matters:* The Constraints section says "any regen flow must
    keep all three in sync," but the Goals only measure Mezo in
    `@x402/paywall` (TypeScript). If Go and Python ship stale in v0.11.0
    the release is partially broken for other consumers. This is the kind
    of thing QA will flag as untestable because no acceptance criterion
    covers Go/Python.
  - *Suggested clarifying question:* "Is `go/http/evm_paywall_template.go`
    and `python/http/paywall/evm_paywall_template.py` shipping chain 31611
    part of the v0.11.0 success criterion, or only the TS paywall? If
    yes, how are Go and Python validated — is grep for `31611` enough,
    or do we need a runtime test per language?"

- **No non-regression requirement for chains other than Mezo.**
  - *Why this matters:* Regenerating the baked template from viem 2.47.12
    will also change the set of chains visible to any operator. If viem
    2.47.12 renamed, removed, or re-IDed a chain between the currently
    locked versions (2.23.2 / 2.37.3 / 2.40.3 / 2.45.1) and 2.47.12, the
    regen could silently break a currently-working chain. PRD does not
    require that the fix preserve parity on all previously-working chains.
  - *Suggested clarifying question:* "Is 'no regression on chains that
    already worked in v0.10.0' an explicit acceptance criterion, or
    acceptable collateral if viem upstream changed a chain definition?
    If it is a criterion, how do we test it — full enumeration of chain
    IDs before/after, or spot-check?"

- **"Recurrence guard" (Goal 4) has no measurable definition.**
  - *Why this matters:* "Define the ongoing mechanism" is a Phase B/C
    deliverable but there are no success criteria: What detection latency
    is acceptable (hours? days? one release cycle?)? What coverage across
    the three templates? What's the allowable false-positive rate before
    maintainers start ignoring the signal? Without targets, Phase B's
    option comparison has no axes to score against.
  - *Suggested clarifying question:* "What are the target properties of
    the recurrence guard: max detection latency when a new chain joins
    viem, coverage (TS only vs. all three templates), and acceptable
    maintainer burden (e.g., PRs per month, CI runtime cost)?"

- **Phase exit criteria are undefined.**
  - *Why this matters:* Phase A says "produce a yes/no staleness call" per
    artifact but doesn't say what constitutes sufficient evidence (local
    repro? CI log inspection? both?). Phase B says "decision table" but
    doesn't define which combination wins — is it lowest maintainer
    burden, fastest detection, or most reproducible? Phase C says "Ryan
    reviews plan" which is fully subjective. A polecat receiving this
    cannot tell when to stop and hand back.
  - *Suggested clarifying question:* "What evidence is required to exit
    Phase A (reproduced locally + workflow walkthrough, or just one of
    those)? What's the selection rubric for the Phase B decision table
    (weighted criteria, or judgment call)? What specific artifacts must
    the Phase C plan bead contain for Ryan-ready?"

### Important Considerations

- **No rollback / recovery requirement.** If v0.11.0 ships with the
  regenerated template and it turns out to have broken a different chain
  (see non-regression gap above), the PRD is silent on the response:
  hotfix release, revert, dependabot rollback. Suggest adding a brief
  "if the released fix is wrong, the response is X" sentence.

- **Observability / post-release verification is absent.** The PRD
  focuses on pre-release local validation but not on how we'll know, in
  the wild, whether v0.11.0 actually fixed Mezo. Is there a telemetry
  signal, a user-report channel, a manual post-release check? The
  "Unsupported chain ID" error is the current failure signal — does
  anyone watch for it now? Without this, a future stale release is
  discovered only when the next Ryan-style user complains.

- **Issue #1971 is referenced but not summarized.** The PRD mentions
  "Issue #1971 proposes Dependabot with grouped weekly updates" as one
  of the recurrence-guard options, but the polecat/plan author would
  need to read #1971 to fully evaluate Option 1. Suggest either inlining
  the relevant proposal from #1971 or explicitly noting #1971 as
  mandatory prerequisite reading.

- **Open Question #10 (x4-v12 interaction) is scope-affecting and should
  move up.** If x4-v12 is the mechanism by which Mezo lands, the entire
  "Mezo fix path" (Phase B, axis 1) is answered before Phase B starts.
  If x4-v12 is orthogonal, Phase B is still required. Resolving this
  question should be a Phase A prerequisite, not a Phase B discovery.

- **"Test payment recipe" is deferred to Phase C.** Goal 2 requires
  local runtime testing, but the recipe ("which wallet, which testnet,
  which paywall config") is a Phase C output. This means Phase A cannot
  use the runtime test as part of its diagnosis — which is fine if
  explicit, but the PRD does not acknowledge this ordering constraint.

- **No timeline / deadline despite imminent release pressure.** The
  problem statement says "v0.11.0 is imminent" and Constraints says
  "upstream cadence is ~7–10 days," but no actual deadline is set.
  Without a cutoff, the "two PRs vs. one" decision (Open Q#7) has no
  forcing function.

- **Definition of "stale" is implicit and should be explicit.** A
  template is "stale" in this PRD if chain 31611 is missing. A more
  robust recurrence guard definition might be "stale if any chain
  present in the current viem release is absent from the baked
  template." The two definitions imply different guards and different
  test gates.

### Observations

- Non-Goals are well-drawn and reduce scope ambiguity meaningfully —
  particularly the "not changing the runtime chain-lookup model" line,
  which prevents scope creep into architecture work.

- Constraints do a good job of fencing the reproducibility property
  ("cannot be lost") but don't define *how* that property will be
  measured post-change. For a QA engineer, "reproducible" is untestable
  without a definition (e.g., "two sequential clean builds produce
  byte-identical published artifacts" vs. "same chain IDs present in
  template").

- The "happy path only" concern from the review prompt applies here:
  every user story is a success story. What happens if the Mezo wallet
  is on the wrong network, if the paywall page errors partway through,
  if the regen step produces a syntactically invalid template, if viem
  2.47.12 is yanked mid-release-prep? None are addressed; most are
  probably acceptable to punt, but the punts should be explicit.

- Phase A step 5 (compare to PR #1920) is useful archaeology but has no
  acceptance criterion — "identify what was patched" could be a
  one-line note or a full root-cause analysis. Worth specifying.

- Goal 5 ("plan bead ready for polecat handoff") is measurable in
  principle but the measurement is "Ryan approves." This is the only
  human-gated goal; the rest could in principle be script-verified.
  Consider whether a checklist (e.g., "plan contains: file changes,
  commit order, validation commands, CI guard spec, decision log")
  would let a polecat self-verify handoff readiness before asking
  Ryan.

## Confidence Assessment

**Medium.** The PRD is strong on diagnosis structure, non-goals, and
constraints, which gives reviewers confidence about *what not to do*.
It is weaker on *what it means to be done*: Goal 1 is underspecified
for acceptance testing, Goal 4's recurrence guard has no measurable
properties, and phase exit criteria are subjective. A polecat could
begin Phase A with the information present, but would likely need to
come back for clarification at every phase boundary — which defeats
the "no further research rounds" aspiration of Goal 5. Filling the
critical gaps above (especially the Goal 1 verification recipe, the
Go/Python scope question, and the recurrence guard targets) would
move this from Medium to High.
