# PRD Review: Paywall SES Lockdown Compatibility (Root-Cause Investigation + Fix)

**Review ID:** td6la
**Source PRD:** `/Users/fox/gt/x402/crew/fox/.prd-reviews/paywall-ses-research/prd-draft.md`
**Linked beads:** x4-1po (fix proposal), x4-v12 (template regen, sequenced first)
**Molecule:** x4-wisp-z2ex (mol-idea-to-plan)

## Executive Summary

The PRD is unusually well-shaped for an investigation bead: it explicitly
frames the two shortlisted remedies as hypotheses rather than the plan,
lists 10 seed questions, and names non-goals. Overall readiness is
**medium-high for launching diagnosis, low for launching a fix.** The
biggest risk is that the stated root-cause hypothesis ("SES lockdown
rejects `??` at parse time") is probably wrong on its face — SES hardens
*runtime* primordials, not syntax — and several findings on the *real*
likely root cause (buffer-polyfill global writes, CSP on host pages,
dependency-internal SES-hostile patterns) need to land before Phase B's
option comparison can be meaningful. A secondary process risk: the convoy
itself was dispatched with an unbound `problem` variable, and 5 of 6
legs produced empty "no input" reports rather than reviewing the draft at
`.prd-reviews/paywall-ses-research/prd-draft.md`. Only the feasibility
leg (rictus) reviewed substantive content; synthesis below leans on that
leg plus the PRD text directly.

## Before You Build: Critical Questions

> Implementation must not start until these are answered. All are
> blocking because each can invalidate the Phase B option comparison
> before it begins.

### Root-cause evidence (Feasibility)

**Q1: What is the exact failure signature on a reproducing page?**
- Why this matters: The PRD assumes `SyntaxError: Unexpected token '??'`
  but provides no captured stack. If the real error is
  `SES_UNCAUGHT_EXCEPTION`, `Cannot assign to read only property` on
  `globalThis`, or a CSP `script-src` violation, Option 1 (esbuild
  target downgrade) does not fix it. Every Phase B option is scored
  against the wrong target until this is pinned.
- Found by: feasibility (critical #1), and implicit in PRD Open
  Question 1.
- Suggested answer shape: attach a devtools console dump (full `errors`
  array), network tab, MetaMask version, and a minimal repro URL to the
  bead before Phase A starts.

**Q2: Is "SES rejects ES2020 syntax" a real SES behavior, or is the
working hypothesis a red herring?**
- Why this matters: `@endo/ses` runs *after* the host's JS engine has
  parsed the script — every browser MetaMask supports parses `??`
  natively. If Option 1 "works" it is almost certainly by incidentally
  changing minified output in a way that sidesteps a *different* SES
  restriction (e.g., the buffer-polyfill assigning
  `globalThis.Buffer`, which is a hardened property). A coincidental
  fix is fragile — the next esbuild or dep bump silently re-introduces
  the break.
- Found by: feasibility (critical #2).
- Suggested answer shape: part of Phase A diagnosis — reproduce with
  es2020 output, then hand-edit the bundle to remove only `??` tokens
  (substituting equivalents) and re-run. If it still breaks, `??` is
  not the cause and Phase B's Option 1 framing changes.

**Q3: Is the true trigger the `buffer-polyfill` writing to
`globalThis.Buffer`, rather than any syntax at all?**
- Why this matters: `typescript/packages/http/paywall/src/evm/build.ts`
  currently does `inject: ["./src/buffer-polyfill.ts"]`,
  `global: "globalThis"`, and `Buffer: "globalThis.Buffer"`. SES
  hardens `globalThis`; writing a non-existent property onto a
  hardened `globalThis` throws. This is a concrete, testable,
  SES-hostile pattern that exists in the current build and is a
  stronger candidate than syntax downleveling. If confirmed, neither
  Option 1 nor Option 2 fixes it — the polyfill strategy has to
  change.
- Found by: feasibility (observation #4).
- Suggested answer shape: tested directly in Phase A via a SES-only
  compartment harness.

### Scope of the fix (Feasibility / Scope)

**Q4: Which flavor of regression guard is in scope?**
- Why this matters: The PRD says "syntax-level lint OR diff-against-
  rebuild OR both" (Open Question 7, Phase C goal 2). These have ~10x
  cost deltas:
  - Static AST syntax gate: ~1 day, brittle, guards only what it
    enumerates.
  - SES-only compartment harness (run the bundle inside standalone
    `@endo/ses`): ~2–3 days, catches the broadest class of issues,
    doesn't reproduce MetaMask's exact LavaMoat policy.
  - Full headless MetaMask + Playwright E2E: weeks-of-work bundle plus
    recurring maintenance cost across MetaMask version bumps.
- Found by: feasibility (critical #3), PRD Open Question 7.
- Suggested answer shape: pick one tier up front. The SES-only
  compartment gate is the best cost/coverage trade-off unless there is
  a specific reason to need MetaMask-in-the-loop.

**Q5: If Option 2 (externalize the inline script) is chosen, which
hosting model is acceptable?**
- Why this matters: The current template is a single self-contained
  HTML blob embedded in Go, Python, and TS servers
  (`evm_paywall_template.go`, `evm_paywall_template.py`,
  `typescript/packages/http/paywall/src/evm/gen/template.ts`).
  Externalizing the script means either (a) every x402-compatible
  server (Go, Python, Next.js middleware, Hono, Elysia, Express, …)
  must serve two URLs — a breaking integrator contract — or (b) a CDN
  host, which adds an external dependency to a payment flow, or (c)
  `blob:`/`data:` URL loading, which often trips SES or CSP the same
  way. This decision changes the x402 server contract and must be
  answered before design starts.
- Found by: feasibility (critical #4).
- Suggested answer shape: document the chosen hosting model in the
  plan bead alongside the Phase B decision.

### Input / process (cross-cutting, flagged by 5 legs)

**Q6: Confirm `paywall-ses-research/prd-draft.md` is the intended
input for convoy `td6la`.**
- Why this matters: The convoy was poured with no `problem` variable
  bound. 5 of 6 legs (requirements, ambiguity, gaps, scope, plus
  likely jeffc/sr6ng siblings) rendered `Problem / Feature: <no value>`
  and produced empty reviews. Only the feasibility leg reviewed the
  actual PRD. Until this is confirmed, the synthesis cannot claim to
  have integrated all six dimensions.
- Found by: requirements, ambiguity, gaps, scope (all critical #1);
  feasibility implicitly via its substantive review.
- Suggested answer shape: confirm the binding, then either (a)
  re-pour `mol-prd-review` with `--var problem=<path-or-bead>` so the
  five empty-input legs get real input, or (b) accept the current
  synthesis as feasibility-weighted and proceed to design with the
  caveat noted.

## Important But Non-Blocking

- **Disambiguate "paywall breaks" vs "paywall breaks *because of SES*"
  on host pages with CSP.** Sites integrating a paywall commonly ship
  a `Content-Security-Policy` header, and a missing `'unsafe-inline'`
  for `script-src` kills an inline `<script>` regardless of MetaMask.
  Phase A should verify the failure reproduces on a page with *no*
  CSP at all before committing to SES-specific remedies.
  *(Feasibility, important #5; PRD Open Question 1.)*

- **es2020 → es2019 is not side-effect-free.** Downleveling affects
  optional chaining, logical assignment operators, `for-of`
  destructuring; does **not** help `BigInt` literals or runtime-only
  APIs like `Promise.allSettled`. esbuild's es2019 output is larger,
  and the bundle already ships as a ~1–2 MB constant inside every
  generated Go/Python template file. Bundle-size delta should be
  measured before/after and tracked as a release note.
  *(Feasibility, important #6; PRD Goal 2, Constraints.)*

- **Dependency-internal SES hostility is possible.** viem 2.47.12,
  wagmi, and React 18 all ship minified code that may mutate
  `Object.prototype`, install non-configurable globals, or use
  `Function`/`eval` under some code paths. If this is the true root
  cause, neither Option 1 nor Option 2 fixes it — the fix is a dep
  patch or upgrade, which is a much larger change with different
  release implications.
  *(Feasibility, important #7; PRD Open Question 6 for wallet
  variants.)*

- **Phase A prerequisite: a SES-equivalent local repro.** Using the
  `ses` npm package with `lockdown()` in a test harness gives ~80% of
  LavaMoat's behavior without needing the MetaMask extension. This
  should be the *first* deliverable of Phase A; every later step is
  guessing without it.
  *(Feasibility, important #8; implicit in PRD Phase A step 1.)*

- **Cross-language regeneration coupling.** Any fix lands in three
  generated files. The x4-v12 regen is sequenced first; ordering is
  correct. If Option 2 is chosen the Go/Python embedding model
  changes shape (constant → constant + second asset), rippling into
  every server's HTTP handler. Not insurmountable, but not free —
  call out in the Phase C plan bead.
  *(Feasibility, important #9; PRD Constraints, Release sequencing.)*

- **Browser-audience data is thin.** PRD Open Question 4 asks for
  esbuild target tuning based on analytics. There is no sign such
  analytics exist; the cheapest substitute is picking a target by
  caniuse baseline ("features at 99%+ global support") rather than
  waiting for real audience data. Document the baseline in the plan
  bead so a future maintainer knows why `es2019` (or whatever) was
  chosen.

- **Mezo field report follow-up.** PRD Open Question 10 references
  `hq-wisp-5urev` ("Staying on v2.9.0 tarballs") — if the Mezo rig
  has a working workaround, incorporating their evidence will
  shorten Phase A.

## Observations and Suggestions

- **Option 3 candidate worth adding to Phase B.** The
  `@craftamap/esbuild-plugin-html` `inline: { js: true }` setting is
  what creates the inline `<script>` block. Flipping `inline.js` to
  `false` emits a separate `.js` asset; the template-generation step
  could then re-inline it as a `<script type="module">` with an SRI
  hash. This keeps the single-HTML-blob integrator contract intact
  while giving the investigator headroom for nonce/CSP-friendly
  loading paths.
  *(Feasibility, observation #1.)*

- **Check all target settings, not just esbuild's.** The package
  `tsconfig.json` and any intermediate `tsc` compile step also have
  a target; a mismatch between tsc and esbuild produces surprising
  output shapes that can look like minifier bugs.
  *(Feasibility, observation #2.)*

- **Convoy tooling hardening (process, not fix).** `mol-prd-review`
  should refuse to pour when `problem` is unbound. All five empty-
  input legs independently recommended this. A precondition check
  (`required_vars: [problem]`) prevents this class of whole-convoy
  wastage and recurrent Dolt commit pollution. Out of scope for
  x4-1po; worth filing as a separate formula-level bead.
  *(Requirements, ambiguity, gaps, scope — all important
  considerations.)*

- **Generic gap checklist for Phase A diagnosis.** From the `gaps`
  leg's scaffolding, a few categories deserve explicit mention even
  for a compatibility fix:
  - *Observability*: Does the paywall surface a detectable "SES
    blocked" error to the seller's analytics, or does it silently
    blank-page? Sellers won't know they're losing conversions
    otherwise.
  - *Rollback*: If Option 1 ships and a future template regen
    silently re-introduces the break, what's the mitigation window?
  - *Audit*: Which release includes this fix, and what's the user-
    facing messaging to sellers bumping to the post-viem-bump
    version?
  *(Gaps, important; partially covered by PRD Goal 4 and Phase C.)*

- **Ambiguity patterns likely to surface when reviewing the PRD's
  language.** From the `ambiguity` leg's x402-adjacent checklist:
  watch for conflating "client" vs "resource server" vs
  "facilitator" in the same sentence, "supported scheme" lists that
  mix MUST vs MAY, and error semantics like "should fail gracefully"
  without status codes. None currently flagged in the PRD text, but
  worth a second pass once the Phase A evidence is in.
  *(Ambiguity, important.)*

## Confidence Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Requirements completeness | **M** | Goals, non-goals, constraints, scenarios, and open questions are all present. Missing: the actual failure stack, audience analytics, and a rollback/observability story. |
| Technical feasibility | **M** | Diagnosis is feasible; fix landscape is wider than the PRD's two hypotheses, and the stated root cause is probably wrong. Regression-guard scope is unbounded until Q4 is answered. |
| Scope clarity | **M-H** | Explicit non-goals are strong. Regression-guard tier and the Option-2 hosting model are the two scope decisions still open. |
| Ambiguity level | **L** *(low = good)* | Language is tight; no substantive ambiguity flagged by the reviewing leg. Re-confirm after Phase A evidence. |
| Overall readiness | **M** | Ready to start Phase A diagnosis. **Not** ready to start Phase B option comparison or Phase C implementation until Q1–Q5 are answered. |

Process-readiness caveat: the convoy input binding failure (Q6) means
5 of 6 review dimensions did not substantively review the PRD. If the
human overseer wants a full six-dimension review before proceeding,
re-pour `mol-prd-review` with
`--var problem=.prd-reviews/paywall-ses-research/prd-draft.md` and
cancel the current empty-input legs.

## Next Steps

- [ ] Human confirms `paywall-ses-research/prd-draft.md` is the
      intended convoy input (Q6).
- [ ] Human answers Q1–Q5 (or authorizes Phase A diagnosis to produce
      the evidence needed to answer them).
- [ ] Optional: re-pour `mol-prd-review` for the five empty-input
      dimensions, or accept the current feasibility-weighted
      synthesis.
- [ ] Updated PRD bead with answers / Phase A findings.
- [ ] Pour `design` convoy to generate the x4-1po implementation plan.
