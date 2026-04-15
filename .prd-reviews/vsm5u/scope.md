# Scope Analysis

## Summary

The PRD has unusually clear non-goals and an explicit "research-first" framing,
which guards against the most common scope-creep failure modes. The Mezo fix
itself is well-bounded (one chain ID, one published release, one validation
recipe). The risk concentrates almost entirely on **Goal 4 — the recurrence
guard** — which is currently a single bullet covering at least four distinct
mechanisms (Dependabot/Renovate config, scheduled lockfile refresh, pre-publish
regen check, CI lint), each with its own design surface, blast radius, and
maintainer-burden profile. As written, "recurrence guard" can stretch to
absorb most of the polecat's time while the actual Mezo ship slips.

The other significant scope ambiguity is the **three-template mirror** (TS, Go,
Python). The PRD treats them as a single regen step, but each has a different
build pipeline and publish workflow, and the PRD never commits to "fix all
three for v0.11.0" vs. "fix TS now, mirror later." That decision determines
whether this is a 1-PR job or a 3-PR job.

## Findings

### Critical Gaps / Questions

- **Recurrence guard is one goal but four-plus mechanisms.** Goal 4 lists
  Dependabot, Renovate, scheduled lockfile refresh, *and* pre-publish regen
  check as candidates, then Open Q6 adds a CI "lint for all viem chains
  present" option, and Open Q7 asks whether guard ships with Mezo or after.
  - Why this matters: each mechanism is its own implementation. If the
    polecat treats "recurrence guard" as one deliverable they will either
    (a) build all of them, or (b) pick one arbitrarily and the others get
    relitigated post-merge.
  - Suggested clarifying question: **"For v0.11.0, is the recurrence guard
    in-scope as a shipped mechanism, or in-scope only as a written
    recommendation in the plan bead? If shipped, which single mechanism?"**

- **Three-template parity is implicit, not committed.** Constraints §2
  acknowledges TS / Go / Python templates must stay in sync, but Goals
  §1 says "Mezo works in `@x402/paywall`" (which is TS-only by package
  name). Open Q3 asks "what needs to happen to Go and Python mirrors?"
  without binding the answer.
  - Why this matters: if Go/Python are in scope, the polecat needs three
    publish-pipeline reviews and three validation recipes. If out of
    scope, that needs to be a stated non-goal so a reviewer doesn't
    block the PR on missing mirrors.
  - Suggested clarifying question: **"Does v0.11.0 need to ship Mezo in
    `@x402/paywall` (TS) only, or in all three of `@x402/paywall`,
    the Go paywall package, and the Python paywall package
    simultaneously?"**

- **"Locally-validatable" deliverable boundary unclear.** Goal 2 + Open Q5
  define the local validation recipe as part of the plan, but it's not
  clear whether the polecat *executes* the runtime recipe (connect a real
  Mezo wallet, complete a test payment) or merely *documents it for Ryan
  to execute*. The constraint "no upstream PR without Ryan's approval"
  implies Ryan does it, but Goal 2 says "Ryan can build, inspect, and
  runtime-test" which reads like all three are Ryan's responsibility.
  - Why this matters: if the polecat is expected to runtime-test, they
    need a Mezo testnet wallet, test funds, and a paywall config — none
    of which are in the polecat's standard environment. If the polecat
    only documents, they need to be told that explicitly so they don't
    block on access they can't get.
  - Suggested clarifying question: **"Does the polecat runtime-test on a
    real Mezo wallet, or only document the recipe so Ryan can?"**

### Important Considerations

- **Phase A "Diagnosis" is genuinely scope-disciplined, but its outputs
  silently expand Phase B.** Phase A enumerates five staleness candidates
  (lockfile, node_modules, TS template, Go template, Python template,
  esbuild cache). The implication is that each "stale" answer pulls the
  matching layer into the fix scope. There's no upper bound — if all five
  are stale, Phase B's "option comparison" expands proportionally. Worth
  stating: a maximum number of fix layers the polecat is allowed to touch
  in one MR before splitting.

- **PR #1920 failure-mode investigation (Open Q8) is unbounded research.**
  "Why did the post-hoc fix restore the default asset but not the chain
  map?" is a worthwhile question, but it could absorb hours of git
  archaeology with no implementation output. Either time-box it or move
  it out of scope and into a follow-up bead.

- **x4-v12 interaction (Open Q10) is the textbook "phase 2 in disguise."**
  x4-v12 is the template-regen bead that's currently sequenced *after*
  this work. If it turns out x4-v12 is the actual mechanism by which
  Mezo lands, then this PRD's deliverable is a research note, not a
  fix — that should be settled before Phase A starts, not surfaced as
  a question after it.

- **"Pre-publish regen check" overlaps with `--frozen-lockfile`.** The
  non-goal "not bypassing `--frozen-lockfile` without trade-off
  analysis" and the candidate guard "pre-publish workflow step that
  re-runs regen" are in tension: re-running regen at publish time
  effectively makes the published artifact non-deterministic relative
  to the committed state (it regenerates from the *resolved* viem
  rather than the committed template). This isn't called out and
  the polecat may stumble into it.

- **No definition of "shipped" for the recurrence guard.** Does
  "Dependabot configured" count as shipped, or does the guard need
  to have demonstrably caught one stale-template scenario in CI
  before it counts? The acceptance bar matters for "two PRs vs one."

### Observations

- Non-goals are unusually well-written — explicit list of five items
  with rationale. This is the strongest scope-control signal in the
  PRD and reduces the risk of the obvious creep ("while we're in
  there, let's externalize chain registries").
- "Not speculatively supporting chains beyond Mezo" is a good phrasing
  — it preserves the recurrence-guard goal while preventing the
  polecat from shipping a registry of every "soon-to-be-supported"
  chain.
- The "two PRs or one?" question (Open Q7) is the right phasing
  question to be asking, but it should have a default answer in the
  PRD ("default to two unless evidence shows the guard is trivial")
  rather than being left fully open — Phase B will otherwise need to
  re-derive the framing.
- Issue #1971 is already open and proposes Dependabot with grouped
  weekly updates. If that issue's proposal is the de facto recurrence
  guard, the PRD should say "adopt #1971's proposal unless Phase B
  surfaces a reason not to," which would collapse Open Q4 substantially.
- The mezo field report (hq-wisp-5urev) is referenced as Open Q9 but
  not loaded into the PRD's context — if the Mezo rig has a working
  workaround on v2.9.0 tarballs, that's potentially an existing
  in-house solution that bounds what "fixed" means.
- Constraints §6 ("branch hygiene") is an implementation detail, not a
  scope constraint — could be moved out of the Constraints section.

## Confidence Assessment

**Medium.** The scope of the *Mezo fix itself* is clear and well-bounded.
The scope of the *recurrence guard* is the dominant risk and is
underspecified — it's currently one goal that could fan out to four-plus
deliverables, and the PRD doesn't commit to an "in this PR vs. follow-up"
split. The three-mirror question (TS-only vs. TS/Go/Python) is the second
major ambiguity and is purely a stakeholder decision, not a research
question. Once those two are pinned, the rest of the scope is tight.
