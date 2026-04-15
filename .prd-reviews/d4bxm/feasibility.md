# Technical Feasibility

## Summary

The PRD's diagnosis story is plausible and well-framed, but its implicit leading
option — "bump esbuild `target` down to es2019" — is not safe to assume without
new evidence. The current baked template
(`typescript/packages/http/paywall/src/evm/gen/template.ts`, ~3 MB minified)
already contains features that **esbuild cannot transpile at any lower target**,
most notably **BigInt literals** (`1n`, `8n`, `-1n`, …) which I counted ~1,800
occurrences of. viem is BigInt-heavy by design, so this is not an accidental
surface — it is structural. If MetaMask's bundled SES parser rejects `1n` the
way it rejects `??`, then Option 1 (`target: es2019`) as written in x4-1po does
not fix the problem, and the PRD's Phase B option set is incomplete.

A second structural gap: the PRD treats SES parser-level rejection as a single
failure mode, but the bundle also uses runtime features (`Object.hasOwn`,
`replaceAll`, `Promise.allSettled`, `globalThis`) and optional-catch-binding
that might fail at parse *or* at runtime depending on SES version. Without a
pinned MetaMask/SES version, Phase A.2 cannot produce a syntax inventory that
is a true pass/fail list — it can only produce "stuff newer than es2019". That
is not the same question.

## Findings

### Critical Gaps / Questions

- **BigInt literals cannot be lowered by esbuild.**
  The current template already contains roughly 1.8k BigInt literals (viem
  types and constants). esbuild's documented behavior is to **emit a warning
  and pass them through** when the target doesn't support BigInt — it does not
  synthesize `BigInt("1")` calls for literal syntax. If SES's bundled parser
  rejects BigInt literal syntax the same way it rejects `??`, then Option 1 as
  scoped in x4-1po (one-line `target: "es2020"` → `"es2019"`) will not fix
  breakage — users will trade `Unexpected token '??'` for `Unexpected token '1n'`.
  - *Why this matters:* the PRD's "recommended path" breaks under a condition
    that Phase A research is supposed to *measure*, not assume away. The
    option-selection logic in Phase B has to fork on this fact.
  - *Ask:* "Does MetaMask's bundled SES accept BigInt literal syntax? If not,
    Option 1 is a no-op for us — what's the fallback?"

- **SES version pinning is unanswered but load-bearing for every option.**
  The PRD's Phase A.4 says "check `@endo/ses` docs/source for the version
  MetaMask ships" but does not name a MetaMask version, release channel, or
  audience cohort. SES's parser-supported-syntax set is an artifact of the
  *bundled* `@endo/ses` version, and MetaMask is known to lag upstream SES
  significantly. Without a pinned version (or version range), every "does SES
  accept X?" question in the syntax inventory has no authoritative answer.
  - *Why this matters:* the regression guard (Goal 4) can't be built without a
    target supported-syntax set, and the target set is a function of a
    specific SES version. Guard cost is linear in version spread (one SES
    version to match = cheap; N versions = harness engineering).
  - *Ask:* "Which MetaMask (and therefore which `@endo/ses`) version(s) are we
    pinning the fix against? Latest-stable-only? Latest + one back? Any?"

- **Option 2 (externalize the script) is asserted but not characterized.**
  x4-1po says "SES lockdown is less aggressive on externally-loaded scripts in
  some configurations" — that claim is not substantiated. SES `lockdown()`
  primarily hardens the realm (freezes intrinsics, replaces `Function`,
  `eval`, `Compartment`). Script parsing itself is normally done by the
  browser JS engine, not by SES. If the inline `<script>` is failing at
  parse time with `Unexpected token '??'`, **that error is from V8/SM, not
  from SES** — unless MetaMask has inserted a pre-parse interception that
  externalization would bypass. We don't know which is true, and the fix plan
  depends on it.
  - *Why this matters:* if the parser is the browser's (not SES's), then
    MetaMask is merely *triggering* something that surfaces the error — e.g.
    reloading the script in a Compartment — and externalizing won't help. If
    SES is the parser (via Compartment.evaluate or similar), externalization
    could help but only for the externalized script, not for code SES later
    re-evaluates.
  - *Ask:* "Can we confirm the failing parser is the browser's JS engine or
    SES's Compartment parser? This decides whether Option 2 is even a
    candidate or a dead end."

- **esbuild `target` lowering is not a monotonic fix.**
  Dropping `target` from es2020 to es2019 lowers `??`, `?.`, optional catch
  binding, and some class fields, but:
  - does **not** lower BigInt literals (see above),
  - does **not** lower `globalThis` references (runtime feature, 111 refs),
  - does **not** lower `Object.hasOwn` / `String.prototype.replaceAll` / some
    `Promise.*` methods (library-level, not syntax-level),
  - does **not** remove class private fields if a dep ships them in published
    JS (dep-shape risk).
  Each of these is a potential SES surface of its own — syntax lowering only
  addresses a subset. The PRD frames this as a syntax problem, but part of the
  risk is runtime-feature shape.
  - *Why this matters:* a successful Phase A ends with a *matrix* (feature x
    SES-accepts? x esbuild-can-lower? x runtime-polyfillable?), not a single
    "target = X" verdict. The PRD doesn't enumerate this matrix.
  - *Ask:* "Is the intent to fix only *syntax-level* SES rejection, or also
    runtime feature mismatches? If only syntax, what's the policy for
    runtime failures we surface later?"

- **The PRD's syntax inventory (Goal 2) already underspecifies the template.**
  PRD §2 open questions cite `grep -c "\?\?"` = 6. In the committed template on
  this worktree I count 487 `??`, 885 `?.`, ~1800 BigInt literals, 215
  optional-catch-binding, 9 `Object.hasOwn` / `replaceAll`, 3 `Promise.allSettled`
  / `Promise.any`. Either the "6" number predates x4-v12's regen (plausible —
  the PRD was drafted before regen lands) or the grep was wrong. Either way,
  the inventory in Phase A.2 is larger and messier than the PRD suggests, and
  that changes what "fix" means.
  - *Why this matters:* decisions about which esbuild target is "enough" rest
    on this inventory. A 6-token inventory suggests "one-liner"; a 3,000-token
    inventory says "the bundle pervasively uses modern JS, so any fix has to
    be a bundle-level transform, not a surgical patch".
  - *Ask:* "Has the Phase A.2 inventory been re-run against the post-v12
    regenerated template? What's the current count per feature?"

### Important Considerations

- **Reproduction infrastructure is non-trivial.**
  Phase A.1 wants a controlled repro: "known MetaMask version, known page,
  known paywall bundle." In practice this means either (a) a headless browser
  harness with a pinned MetaMask extension build loaded, or (b) loading
  `@endo/ses` standalone at a version that matches MetaMask's bundle and
  running `lockdown()` in a Playwright/Puppeteer harness. Option (b) is
  approximate — it tests SES-as-library, not MetaMask's integration. Option
  (a) is closer to ground truth but expensive to set up. PRD says
  "reproducible by another engineer" but doesn't budget for this.

- **CI regression guard has two non-overlapping halves.**
  PRD C.2 proposes "rebuild-and-diff" plus "lint against SES-supported
  syntax". These answer different questions:
  - Rebuild-diff catches "regenerated artifact drifts from committed artifact"
    — it's a build-determinism check. It does NOT catch "someone bumped esbuild
    target". It only catches "committed artifact is stale".
  - Syntax lint against an SES-supported set is the actual SES-safety gate.
    It requires a maintained list (see SES-version question above).
  - Both are needed. Cost: rebuild-diff is cheap (~1 `npm run build`,
    existing tooling). Syntax lint is a **new AST tool with a maintained
    supported-syntax list**, which is real engineering — not a trivial add.

- **Three generated artifacts, not one.**
  `build.ts` writes TS, Python, and Go template files, all from the same
  `evm-paywall.html`. Any guard that validates the TS artifact must either
  (a) also validate the Python and Go derivatives match (checksum diff), or
  (b) trust the generator. If downstream consumers pin a language-specific
  version, a guard that only checks TS could let Python/Go drift. Cost of
  validating all three is small (hash comparison) but has to be written.

- **Externalization changes the deployment model.**
  The paywall ships as a *single HTML artifact* — that is the value
  proposition (`inline: { js: true }` in `build.ts:45-48`). Externalizing the
  script requires the server framework integrations
  (`x402-hono`, `x402-express`, `x402-next`, `x402-fastify`, cross-language
  server libs) to serve a JS asset and to coordinate URL, cache, CSP, and SRI
  metadata. That is a cross-package change — not scoped to
  `packages/http/paywall` — despite the PRD's "scoped to build config"
  non-goal. If Option 2 is chosen, the blast radius is materially larger than
  the PRD implies.

- **CSP interaction is not characterized.**
  If a seller deploys the paywall under a strict CSP (`script-src 'self'`),
  externalizing the script changes CSP requirements (need to allow the asset
  URL) and may require SRI. Inline script already requires `'unsafe-inline'`
  or a nonce. The PRD lists CSP as a hypothesis to rule out in Phase A.3 but
  doesn't tie it back to Option 2's consequences — which is where it
  materially bites.

- **MetaMask version spread in the wild.**
  MetaMask auto-updates are opt-in-fast but there's a long tail of
  self-hosted / enterprise-distributed MM builds. A fix that works against
  "current MetaMask" may not work against versions in the field. No audience
  telemetry is claimed (PRD Q4). Without it, "works in my test harness"
  becomes "ships to a fraction of the audience and breaks others" — exactly
  the scenario the fix is trying to prevent.

### Observations

- `esbuild` warnings that surface "cannot lower this syntax/feature for the
  target" are suppressible but they are the exact signal we want. Any build
  step that hides esbuild warnings (e.g., `--log-level=error`) would silently
  mask this class of bug. Worth a Phase A sanity check: is the current
  `npm run build` surfacing esbuild warnings at all?

- The generated templates (`evm_paywall_template.py`, `evm_paywall_template.go`)
  both go through `JSON.stringify(html)`. That means the SES-rejected tokens
  are visible as literal JS inside a JSON-escaped string. Any syntax lint has
  to either (a) parse the JSON, extract the embedded JS, and parse that, or
  (b) lint the pre-stringified `OUTPUT_HTML` instead. Option (b) is simpler;
  `build.ts:77` reads that file before stringifying.

- `build.ts:54` injects a `buffer-polyfill.ts`. Any polyfill injection is
  itself subject to the same SES parser — it's code shipped in the bundle.
  Worth verifying the polyfill doesn't contain ES2020+ syntax that would
  sneak in under any target.

- `tsup` is the package build (per `package.json`) — that's the *consumer
  package* build, separate from the inline-script `esbuild` build that
  produces `template.ts`. Two esbuild/tsup passes exist; the SES problem is
  only in the inline-script one. A regression guard scoped to `tsup` would
  miss the bug entirely. The guard has to hook into the correct build script
  (the `build.ts` in `packages/http/paywall/`).

- `@endo/ses` versions and LavaMoat (MetaMask's SES wrapper) have public
  source on GitHub; MetaMask's main repo publishes its `lockdown()` bundle.
  Version pinning is tractable research — a few hours of reading their
  release notes and comparing to the `@endo/ses` changelog. Not blocked on
  anything; just needs someone to do it.

- The CI workflows (`.github/workflows/*.yml`) include `check_lint.yml` and
  separate publish workflows per package — but there is no existing
  `check_paywall_bundle.yml` or similar. The regression guard is net-new
  workflow surface, not a hook into existing CI.

## Confidence Assessment

**Medium.** The code-level claims (target setting, feature counts, build
structure, artifact generation, polyfill injection) are directly verifiable
and verified against this worktree. The SES-side claims (MetaMask ships old
SES, parser is SES vs. browser, BigInt-literal handling under SES) are
*plausible but unverified* — they are exactly the Phase A research work the
PRD commissions, and the feasibility answer is genuinely contingent on that
research. Flagging this as Medium rather than High because two of my
critical findings (BigInt literals uncovered by target downgrade; unclear
which parser is failing) directly threaten the PRD's implicit preferred
option, and if either is wrong, the fix path collapses. The PRD is right to
insist on research-first; it should also expand its option set to include a
"bundle-level lowering via @babel/preset-env or swc" path in case esbuild's
target ceiling isn't low enough.
