# Stakeholder Analysis

## Summary

The PRD names four stakeholder roles directly: end users with MetaMask, sellers
shipping `@x402/paywall`, x402 maintainers, and (upstream, out of scope) the
MetaMask team. That framing is sound for the *technical* problem but
under-specifies several stakeholder groups who will materially affect — or be
affected by — the outcome: users on **other SES-using wallets**, **downstream
rigs already deploying field workarounds** (e.g. Mezo per Q10), **consumers of
the Go and Python regenerated paywall artifacts**, **sellers who do not
regenerate templates** when they upgrade, **operators who would have to host an
externalized script** under Option 2, and **whoever fields end-user paywall
breakage reports today**.

The most consequential stakeholder gap is between the two main fix candidates.
Option 1 (esbuild target downgrade) has a near-zero stakeholder footprint —
internal change, no API/deploy shift. Option 2 (externalize the inline script)
silently changes the deployment contract that thousands of sellers built
against ("drop this HTML in, it works"). The PRD acknowledges the tradeoff
abstractly under "deployment impact" but does not name the seller cohort whose
integrations would break or the operator cohort who would have to serve the
script. Those stakeholders should be made first-class in the option comparison,
not collapsed into a "deployment burden" cell.

## Findings

### Critical Gaps / Questions

- **Mezo rig field workaround (Q10) is referenced but not staffed.**
  - The PRD asks "what did we learn from mezo/fox" but does not assign anyone
    to actually go ask them, nor define what "informs the fix" means as an
    exit criterion.
  - Why this matters: if Mezo has already converged on Option 1 in production
    and validated it across their wallet mix, that is the strongest signal we
    will get — better than any synthetic repro. If they pinned to v2.9.0
    tarballs because *Option 1 didn't work for them*, that is critical
    contradicting evidence.
  - **Suggested clarifying question:** Who owns the Mezo conversation, by when,
    and what's the minimum data set we need from them (wallet versions tested,
    workaround chosen, residual breakage)?

- **The Go and Python codegen consumers are unowned.**
  - Q8 raises "which artifact is the source of truth" but does not identify
    the Go and Python artifact *consumers* as stakeholders. Three artifacts
    ship; the PRD scopes the fix and the regression guard primarily to the TS
    template.
  - Why this matters: if a Go-server seller bumps `@x402/paywall` (or the Go
    package equivalent) and serves the regenerated bundle, do they get the
    fix? Or does the codegen pipeline need a parallel guard? A
    plan that fixes only the TS path and leaves the generated artifacts to
    "mirror it eventually" risks the Go/Python paywall being broken on a
    different cadence than TS.
  - **Suggested clarifying question:** Who owns the Go and Python paywall
    bindings, are they on the same release cadence as the TS package, and
    does the regression guard need to validate all three artifacts before
    merge?

- **No named owner for the option decision.**
  - The PRD explicitly says "do NOT commit to Option 1 or Option 2 until the
    review surfaces evidence" but does not say *who decides* once evidence is
    in. Crew fox alone? Mayor sign-off? Cross-rig consensus given Mezo is
    affected?
  - Why this matters: research-first plans stall at the decision boundary if
    the decider isn't pre-named. The "Implementation-ready plan" goal (Goal 5)
    is gated on this.
  - **Suggested clarifying question:** Who is the named decider, and what's
    the threshold for them choosing Option 2 over Option 1 (since Option 1 has
    materially smaller stakeholder blast radius)?

- **Sellers on stale paywall versions are not in the rollout plan.**
  - The PRD plans CI gates and seller-upgrade-confidence (Story 2) but does
    not address the cohort of sellers who *do not* upgrade and remain broken
    for MetaMask users.
  - Why this matters: this is a *production* breakage. Some fraction of sellers
    will not upgrade promptly. If we have any communication channel to
    sellers (release notes, Discord, mailing list), this fix needs an
    accompanying advisory, not just a code change. If we have no such
    channel, that itself is a gap to surface.
  - **Suggested clarifying question:** Is there a seller-comms channel, and
    does this release warrant an advisory? If no channel exists, should
    creating one be in scope?

### Important Considerations

- **Other SES-using wallets are scoped out empirically but the question is
  framed too narrowly.** Q6 asks "Rabby? Rainbow? Any wallet that uses
  `@endo/ses`?" but the PRD's Non-Goals section says "not speculatively
  supporting non-MetaMask wallets' sandboxes unless investigation surfaces
  them." This is reasonable, but the *investigation step that would surface
  them* is not in Phase A. The phase-A reproduction targets a single
  wallet/version. Recommend Phase A explicitly include a 30-minute survey of
  whether Rabby/Rainbow/Frame ship SES today.

- **Option 2 (externalize the script) needs a hosting-operator stakeholder.**
  If externalization is on the table at all, someone has to host the asset.
  The PRD treats "deployment model becomes CDN, server-served asset" as a
  trade-off cell but does not name the operator who would maintain the CDN,
  manage cache invalidation across paywall versions, or pay the bandwidth
  bill. If x402 has no hosting infra today, Option 2 is not really a
  one-engineer fix — it implies standing up new infrastructure. That should
  disqualify it from "minimal change" framing in the comparison.

- **Developer experience after the CI gate lands.** The regression guard is a
  good call, but Goal 4 doesn't specify the *failure-mode developer
  experience*. When the gate fires on someone bumping viem in 6 months, will
  they understand why CI is red? The bug is subtle (parser-policy rejection
  in an injected sandbox); a CI failure that says "syntax not in SES
  supported set" without a runbook will produce confused engineers and
  bypassed gates. Recommend the deliverable include error-message copy plus
  a one-page doc the gate links to.

- **Internal team dependency: Refinery / merge queue.** The PRD bundles v12
  regen + 1po fix + CI guard "in one PR unless review surfaces a reason to
  split." That is fine for landing speed but means any rollback hits all
  three changes together. Refinery owners (or whoever owns main health)
  should be aware that this PR concentrates risk. Not a blocker, but a
  notification.

- **Conflicting need: minimal-blast-radius vs. future-proofing.** Option 1 +
  guard solves today's break and tomorrow's recurrence with a single
  lever. Option 3 (hybrid) adds the future-proof lint on top, costing more
  build complexity. The conflict is between maintainers who want surface
  area minimized and maintainers who want never-again guarantees. The PRD's
  decision table should make this tension explicit rather than presenting
  Option 3 as a strict superset.

### Observations

- **Browser-version analytics (Q4) is a stakeholder dependency.** "Do we have
  analytics on paywall audience browser versions" is a question whose
  answer depends on whoever owns paywall telemetry — possibly a different
  rig than x402. If the answer is "no analytics," Phase A's "decide to
  skip" branch is fine, but the *decision to skip* should be logged so a
  later "we should've collected this" complaint has a paper trail.

- **The seller cohort is not homogeneous.** The PRD treats "seller" as one
  role, but realistically: (a) sellers who consume the npm package and rebuild,
  (b) sellers who use the prebuilt bundled HTML drop-in, (c) sellers using
  the Go binding, (d) sellers using the Python binding. Each has a different
  upgrade path and different exposure to a deployment-model change.

- **End-user with non-MetaMask wallet is a quiet stakeholder.** They are not
  broken today and won't be broken by Option 1. They could plausibly be
  affected by Option 2 if external script loading hits an ad blocker or
  CSP rule on their host page. Worth a single-sentence callout in the
  Option 2 row of the comparison.

- **Witness / Refinery as launch-coordination stakeholders.** Self-serve
  applies — this rig already routes through them via the merge queue. No
  external launch coordination appears necessary, but that's worth one
  sentence in the plan to make it explicit ("no external launch coord
  required") rather than implicit.

- **Support / triage as a missing role.** The PRD does not name who fields
  paywall-broken-on-MetaMask user reports today, nor who would update any
  status page or known-issues doc post-fix. If that role is "no one," that
  *itself* is the finding and should be made visible in synthesis — it
  shapes how aggressive the rollout messaging needs to be.

## Confidence Assessment

**Medium.** The PRD is unusually well-structured for a research-first plan
and most of the major engineering stakeholders (maintainers, sellers, end
users) are at least named. The gaps are concentrated in (a) downstream
artifact consumers (Go/Python paywall), (b) cross-rig coordination
(Mezo workaround already in field), (c) named decision-owner for the
option choice, and (d) post-launch support/triage role. None of these are
deal-breakers, but each is the kind of unspecified-stakeholder gap that
typically produces "we forgot about X" rework two weeks after merge.

Confidence is not "high" because the stakeholder picture for Option 2
specifically is so under-developed that the decision table risks treating
it as a plausible peer to Option 1 when its true cost (operator burden,
seller integration breakage) is much larger than a one-line build.ts
change. If the synthesizer accepts the PRD's option list at face value,
the comparison may understate that asymmetry.
