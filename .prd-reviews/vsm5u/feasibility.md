# Technical Feasibility

## Summary

The fix itself is technically straightforward — regenerate the baked paywall
template against a viem ≥ 2.47.10 install and commit the three mirrored
artifacts (TS / Go / Python). There are no deep architectural obstacles
and no third-party capability gaps. What makes this non-trivial is the
*release pipeline model* the PRD describes, which I believe is partially
inaccurate and leads to a recurrence-guard design that may not work.

Specifically, the publish workflow does **not** re-run `build:paywall` —
it runs `tsup`, which consumes the already-committed `template.ts` as a
string constant. The committed template is produced by a developer running
`pnpm build:paywall` locally; its freshness has nothing to do with the
publish-time `--frozen-lockfile`. That has direct implications: (a) a pure
lockfile-refresh strategy (Dependabot, scheduled `pnpm update`) will NOT
by itself unstale the bundle — it only unstales it after someone runs
`build:paywall` and commits the template; (b) bumping viem in package.json
without refreshing the lockfile AND re-running build:paywall is a no-op;
(c) the cheapest recurrence guard is a CI step that re-runs
`pnpm build:paywall` and diffs against the committed artifacts, but that
gate has its own feasibility risks around non-determinism and cost.

Also flagging: the three-template regen is atomic (one invocation writes
all three) — so partial-commit drift between TS / Go / Python is a distinct
failure mode that the PRD doesn't name. And the Dependabot option from
#1971 is not sufficient on its own without a companion regen step.

## Findings

### Critical Gaps / Questions

- **The PRD's causal model of "publish uses frozen-lockfile → stale bundle"
  does not match the code.** The publish workflow runs
  `pnpm -r --filter=@x402/paywall run build` which resolves to `tsup`, not
  `build:paywall`. `tsup` imports `src/evm/gen/template.ts` as a plain
  module and packages the JSON-stringified bundle as-committed. The
  installed viem version at publish time is irrelevant to the bundle's
  chain set; only the viem version at the time whoever-last-ran
  `build:paywall` matters. This inverts the whole Phase A diagnosis: the
  stale artifact is always the committed `src/evm/gen/template.ts`, full
  stop.
  - *Why this matters:* Phase B options "scheduled CI job that runs
    `pnpm update viem && diff`" or Dependabot alone will NOT land Mezo in
    v0.11.0 unless a human or bot also runs `build:paywall` and commits.
    A recurrence guard predicated on lockfile freshness catches nothing.
  - *Suggested clarifying question:* "The publish workflow calls `tsup`,
    not `build:paywall` — so the stale artifact is always the committed
    `template.ts` (and its Go/Python mirrors). Given that, should the
    recurrence guard be (a) a pre-publish CI step that re-runs
    `build:paywall` and fails on diff, or (b) a bot PR that regenerates
    when viem updates, or (c) both?"

- **Dependabot cannot regenerate the baked template.** Dependabot bumps
  package.json + lockfile; it cannot run `pnpm build:paywall` (which
  requires esbuild + `@craftamap/esbuild-plugin-html` and writes out ~1-2
  MB of bundled HTML into three language mirrors). A Dependabot PR for
  viem 2.48.0 would be mergeable without touching `template.ts`, and
  would ship stale in the next release. Issue #1971's suggestion is
  necessary-but-insufficient.
  - *Why this matters:* "Dependabot with grouped weekly updates" is
    explicitly listed as a Phase B candidate and as the #1971 proposal.
    Ruling it out as *sufficient* before Phase B starts avoids wasted
    option-evaluation effort.
  - *Suggested clarifying question:* "Is the intent that Dependabot is
    paired with a CI gate that re-runs `build:paywall` and blocks the PR
    on a non-empty diff? Without that pairing, Dependabot alone ships
    stale templates."

- **Baked template diff stability is unknown.** The template is a
  JSON-stringified esbuild bundle, minified, ~1-2 MB. A CI "regen and
  diff" guard only works if the diff is deterministic across Node
  versions, esbuild versions, plugin versions, and installation order.
  Any non-determinism (chunk ordering, minifier variability, path
  normalization, transitive dep drift between CI and committer's machine)
  produces spurious diffs that will either force unwanted merges or get
  ignored.
  - *Why this matters:* Option "(4) pre-publish workflow step that
    re-runs regen and fails if diff non-empty" is the only recurrence
    guard that actually catches the failure, but it's viable only if
    diffs are stable. This needs an empirical check during Phase A, not
    a Phase C assumption.
  - *Suggested clarifying question:* "Can Phase A include one empirical
    test: run `pnpm build:paywall` twice in a clean checkout (same Node,
    same lockfile, same machine), and confirm byte-identical output? If
    not, the diff-based CI gate is structurally unreliable and we need
    a different guard design (e.g., a lint that greps `template.ts` for
    a required set of chain IDs)."

- **Three-template atomic regeneration is not enforced.** `build.ts`
  writes `template.ts`, `template.py`, and `template.go` in the same
  invocation, but nothing prevents a developer from committing only one
  of the three. A commit of TS-only (common in a TS-focused workflow)
  ships Go/Python consumers stale. PRD Constraint "Three mirrored
  templates ship" is asserted but no enforcement mechanism is specified.
  - *Why this matters:* Goal 1 is only measured in `@x402/paywall` (TS).
    If Mezo is fixed in TS but Go/Python ship unregenerated, we declare
    victory on v0.11.0 and immediately have the same bug on the Go and
    Python release trains. The recurrence guard must enforce all three,
    not just TS.
  - *Suggested clarifying question:* "Should the CI gate (or pre-commit
    hook) block commits that modify `template.ts` without also modifying
    `template.py` and `template.go`? Or do we accept that Go/Python are
    on a separate release cadence and just ship updates when developers
    remember?"

- **PR #2013 (viem 2.47.12 bump) may not actually be effective.** Current
  `typescript/packages/http/paywall/package.json` on this branch still
  shows `"viem": "^2.39.3"`, and `typescript/pnpm-lock.yaml` resolves the
  paywall workspace's viem to `2.40.3` (lines 577-579). Either PR #2013
  hasn't merged to what this worktree sees as main, it was reverted, or
  the bump was made in a workspace that isn't the paywall. Before Phase
  A concludes, we need to verify what actually landed, because the PRD
  says "PR #2013 bumped viem to 2.47.12 in package.json on 2026-04-13."
  - *Why this matters:* If the package.json was bumped but the lockfile
    wasn't refreshed, `pnpm install --frozen-lockfile` will reinstall
    2.40.3 and the local `build:paywall` produces a stale template.
    That's a pre-existing misconception about the state-of-the-world
    that would cause a polecat to start from a false premise.
  - *Suggested clarifying question:* "What is the exact state of PR
    #2013 on upstream/main right now? Is the bump in the lockfile, or
    only package.json? If only package.json, the fix also needs a
    lockfile refresh — which creates a reproducibility conversation
    before we even regen the template."

### Important Considerations

- **No runtime chain-injection extension point.** `EvmPaywall.tsx` line 58
  does `Object.values(allChains).find(c => c.id === chainId)` against a
  namespace import resolved by esbuild at bundle time. There is no way
  for an operator to inject a chain at runtime without forking the
  paywall. This matches PRD's "not changing runtime chain-lookup model"
  non-goal but has a concrete consequence: every new chain *requires* a
  republish. There is no emergency mitigation if a future chain ships
  stale — users are broken until a new `@x402/paywall` is released. The
  recurrence guard is therefore load-bearing; we cannot treat it as a
  nice-to-have.

- **Bundle size grows unboundedly with viem's chain set.** Current
  template is ~1-2 MB (per `build.ts` logging). As viem adds chains, the
  whole viem/chains namespace is pulled into the IIFE bundle (esbuild
  cannot tree-shake `Object.values(allChains)` statically). This is not
  a v0.11.0 blocker but it's a latent scale problem — every chain adds
  bytes to every paywall page load forever. Flagged for awareness; out
  of scope for this PRD.

- **Local validation is under-specified and the setup is non-trivial.**
  To runtime-test chain 31611 locally, Ryan needs: (a) a paywall server
  configured to return a 402 with `network: "eip155:31611"`, (b) a
  MetaMask wallet with Mezo (31611) added as a custom network, (c) a
  USDC (or chosen asset) balance on that wallet, (d) a compatible
  facilitator for Mezo (or a mocked one). None of this is documented in
  the PRD's Phase C step 2. A polecat handed this plan will need
  fallback scaffolding — or we scope validation to static assertions
  (`grep -c '31611' template.ts` + a unit test that `Object.values` finds
  the chain) and defer runtime-signed-tx validation to Ryan separately.

- **Go and Python package release cadences.** TS publishes via npm from
  the publish workflow. Go modules don't publish anywhere (they're
  consumed via `go get github.com/x402-foundation/x402`), so "shipping
  v0.11.0" has no single moment of truth for Go. Python publishes
  separately (there's a `python/x402/http/paywall/` directory but the
  publish workflow I read is TS-only). PRD doesn't specify what "Mezo
  shipping" means for Go or Python — they may already be "shipping" the
  moment any regenerated template is committed to main, independent of
  a TS npm release. This ambiguity affects Goal 1 scoping.

- **SVM paywall is on the same build pipeline.** `build:paywall` runs
  both `src/evm/build.ts` and `src/svm/build.ts`. SVM is out of scope
  for Mezo, but any CI gate that runs `build:paywall` also runs SVM, and
  any diff check covers both. If SVM's template has its own drift
  problems, this gate might surface unrelated failures and cause
  friction. Low-risk but worth knowing before designing the guard.

- **`pnpm install --frozen-lockfile` is correctly preserved.** PRD
  Constraint "reproducibility of published artifacts" is already
  respected by the current pipeline — templates are committed artifacts.
  The fix does not require touching `--frozen-lockfile` at all, which
  removes a big surface-area concern the PRD flags. This should make
  Phase B's reproducibility trade-off analysis mostly trivial: the
  freshness guarantee lives upstream of publish, not inside it.

- **legacy paywall template also exists.** `python/legacy/src/x402/evm_paywall_template.py`
  is a separate artifact (legacy module path). PRD doesn't address it.
  If any consumer still imports from the legacy path, they ship stale
  forever unless regen covers that target too — but `build.ts` only
  writes to the non-legacy path. Needs a call on whether legacy is
  abandoned or still supported.

### Observations

- **The error path is bundled-code, not library-code.** The "Unsupported
  chain ID" throw is in `EvmPaywall.tsx` which gets baked into
  `template.ts` by esbuild. Source-level fixes to the paywall package
  don't reach users until the template is regenerated and committed.
  This means the plan bead's test strategy needs to validate the *built*
  template, not source-level unit tests — a subtle but important framing.

- **The Mezo field report (PRD Q9) almost certainly relates.** The
  Mezo rig pinning `v2.9.0` tarballs suggests they lost confidence in
  the npm release channel and pinned a known-good bundled version. This
  is evidence the bug has real downstream impact and that the "fix
  forward in v0.11.0" strategy is not something operators can work
  around indefinitely.

- **PR #1920 failure mode (Q8) is almost certainly this**: the PR fixed
  the default asset (a source-level constant in `@x402/paywall` library
  code) but did not re-run `build:paywall`. The maintainer treated the
  fix as "source change → tsup rebuild → published" without realizing
  the template is generated by a separate command. If that's right, it's
  not a "remember to regen" failure — it's a discoverability failure.
  "Remember to regen" is therefore NOT an acceptable recurrence guard;
  we need a CI gate.

- **`build:paywall` requires the Python and Go directories to exist at
  build time.** `build.ts` warns and skips (lines 108-110, 118-120) if
  they're missing — it doesn't fail. A CI job running only inside the
  typescript subtree (without a full checkout) would silently skip
  Go/Python regen and still exit 0. Any CI gate must check that all
  three outputs were written, not just that the command succeeded.

- **Template output is `JSON.stringify(html)` with no further
  normalization.** (`build.ts` lines 83, 88, 96) Non-determinism in
  esbuild output or htmlPlugin ordering will directly surface as diffs.
  This reinforces the diff-stability concern above.

- **The `chore/bump-viem` branch note** in PRD constraints implies
  earlier work exists. Worth grep'ing git for context on what was
  attempted before, but nothing needs blocking on it.

## Confidence Assessment

**Medium-High.**

I'm confident about:
- The publish workflow does NOT re-run `build:paywall` (verified against
  the yaml and package.json scripts).
- The staleness mechanism is the committed template, not the lockfile
  at publish time.
- viem is currently pinned at 2.40.3 for paywall in the lockfile on
  this worktree (does not include Mezo).
- Three-template atomic-regen and partial-commit risk are real.
- Dependabot-alone is insufficient without a companion regen step.

I am less confident about:
- Diff stability of the baked template across CI runs — I have not
  actually run `build:paywall` twice to verify. This is the single
  biggest unknown for the recurrence-guard design.
- The actual merged state of PR #2013 on upstream main — I only
  inspected this worktree's tree, which may lag.
- The exact local-validation environment for Mezo (RPC endpoints, USDC
  contract, facilitator availability). This is a Phase C concern, not
  a Phase A blocker, but it could double implementation effort if
  discovered late.
- Whether SVM's template has any drift issues that would confound a
  shared CI gate.

Overall: the feasibility picture is clearer than the PRD suggests, and
the plan should be simpler (just regen + commit + CI gate) — but the
PRD's root-cause narrative needs correcting before Phase A, or the
polecat will chase the wrong variable.
