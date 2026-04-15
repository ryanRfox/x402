# Ambiguity Analysis

## Summary

The PRD is unusually well-structured for an early draft — Goals, Non-Goals, Constraints, and Open Questions are all present and mostly crisp. That said, a careful read surfaces a cluster of ambiguities that will absolutely cause PR-review debate or mid-flight scope drift if not tightened before x4-1po is dispatched. The biggest risks concentrate around three areas: (1) the **ordering relationship between x4-v12 (template regen) and x4-1po (the fix)** — the PRD treats them as "sequenced" but the actual order is mechanically load-bearing and never stated explicitly; (2) the **scope of "offending syntax"** — the PRD oscillates between "ES2020+" (a tooling target) and "SES-rejected syntax" (an empirical set) without committing to one as the authoritative list; and (3) the **security framing of Option 2 (externalize)** — the Constraints section declares transpiling `??` is not a security downgrade, but leaves the security impact of externalization explicitly open, creating an unstated asymmetry between the two main candidate fixes.

There are also a handful of vague quantifiers ("majority", "non-trivial slice", "sweet spot", "minimal") that are fine as prose but will each force a judgement call at implementation time. Most are resolvable with one or two clarifying sentences each.

## Findings

### Critical Gaps / Questions

**1. Template regen (x4-v12) vs. fix (x4-1po) ordering is mechanically ambiguous.**
- Line 13 says regen "is the natural moment to land a fix." Line 42 says "x4-v12 is cooked first on the same branch. x4-1po work lands on top." Line 81 says the chosen option is "implemented on a clean branch off `upstream/main` (co-located with x4-v12 regen)."
- **Why this matters:** If the chosen fix is a target downgrade, the esbuild config change MUST happen BEFORE the regen or the regen will produce ES2020+ output that then needs to be regenerated AGAIN. "v12 cooked first, 1po on top" reads like the opposite order. A build engineer implementing this literally would regen, commit, then change the target, then have to regen again — wasted work and a noisy diff.
- **Suggested clarifying question:** Is the intended sequence (a) regen template with current config → apply fix → regen again, or (b) apply build-config fix → regen template once with the new config → commit both? The PRD should state the mechanical order, not just the logical sequencing.

**2. "Offending syntax" is defined by two incompatible scopes.**
- Goal 2 says "every ES2020+ (and newer) feature present in the current baked template." But ES2020 is a tooling boundary, not an SES-rejection boundary. SES rejects specific constructs; it does not uniformly reject "everything in ES2020+". For example, `BigInt` literals are ES2020 but may be accepted by SES; `??` is ES2020 and is rejected. Some features SES rejects may not even be "ES2020+" (e.g. certain proposals, or features introduced via runtime semantics).
- **Why this matters:** The inventory artifact (Phase A step 2) and the CI guard (Phase C step 2) both depend on which definition is authoritative. An inventory of "ES2020+ features" may contain many false positives (syntax that is fine under SES) and miss features SES specifically rejects for non-version reasons. A CI guard built on the wrong list either blocks benign changes or lets real breakage through.
- **Suggested clarifying question:** Is the guardrail "target ≤ esYYYY" (a compiler contract) or "zero occurrences of a specific SES-rejected syntax set" (an empirical contract)? Only the latter actually protects against recurrence; the former is a proxy that can silently drift.

**3. Security asymmetry between Option 1 and Option 2 is asserted but not reasoned.**
- Line 41: "transpiling `??` is NOT a security downgrade — SES rejects it by parser policy, not by threat model. Other fixes may have real security implications and must be analyzed."
- **Why this matters:** This sentence pre-loads the review toward Option 1 while Goal 3 insists the review should not pre-pick an option. Two engineers will read this and disagree: one will treat it as decisive framing ("downgrade is free, externalize is risky — done"), another will treat it as a neutral observation to be re-examined. Combined with "Targeted change, not a platform shift" (line 28), the PRD is leaning toward Option 1 while claiming not to.
- **Suggested clarifying question:** Is the intent that the decision framework treats Option 1's security cost as zero by fiat, or that the review should independently evaluate both options' security impact on equal footing?

**4. The CI regression guard is described with two inconsistent shapes.**
- Goal 4 calls for "a CI-enforceable check" (singular). Phase C step 2 calls for a CI gate that "(a) re-builds the template and diffs against committed artifact, (b) lints the committed template against the SES-supported syntax set. Both failures fail CI." (two gates). Open Question 7 asks "Syntax-level lint of the baked template? Diff-against-fresh-build CI gate? Both?" — treating the question as still open.
- **Why this matters:** Phase C already answers "both" but Open Question 7 reopens it. Implementer doesn't know whether to build one guard or two, or whether this is a pre-decided outcome or still a live design question.
- **Suggested clarifying question:** Is the two-guard design in Phase C a prescription, or a placeholder that the review should validate/modify? And does "minimal CI guard" (Non-Goals line 26) mean singular or "as small as needed"?

**5. Artifact-of-truth question is flagged but blocks CI guard design.**
- Open Question 8: "Which artifact is the source of truth? The TS template, the generated Go file, the generated Python file — all three ship. Does the guard need to validate all three, or just the TS and let generation mirror it?"
- **Why this matters:** The answer directly shapes Phase C step 2. If Go/Python generation is lossy or can introduce syntax drift, TS-only validation is insufficient. If they're mechanical transforms, TS is fine. The review cannot produce an "implementation-ready plan" (Goal 5) without resolving this.
- **Suggested clarifying question:** For crew/fox — do the Go and Python generators ever emit syntax not present in the TS source? If no, TS-only validation is safe and should be stated so.

### Important Considerations

**6. "Majority of EVM paywall traffic" / "non-trivial slice" are asserted without data.**
- Line 11 claims MetaMask is "a majority of EVM paywall traffic"; line 40 prohibits silently dropping "a non-trivial slice." Open Question 4 admits "Do we have analytics on paywall audience browser versions?" is unknown.
- Two engineers will disagree on what "majority" and "non-trivial" mean when applied to a target downgrade decision (es2019 vs es2017 vs es2015). Suggest stating either a real number (with a source) or explicitly downgrading these to qualitative claims pending analytics.

**7. "Sweet spot" esbuild target is undefined.**
- Open Question 4: "which esbuild `target` is the sweet spot?" No decision criteria given. Is the sweet spot (a) the newest target SES accepts, (b) the target that preserves the most browser share above some threshold, (c) the target that changes the least about current output, or (d) something else? The review synthesis step cannot pick "Option 1" without this criterion.

**8. "Scope of affected wallets" contradicts Non-Goals.**
- Non-Goal line 29: "Not speculatively supporting non-MetaMask wallets' sandboxes unless the investigation surfaces them. Scope is empirically observed breakage." But Open Question 6 explicitly asks about Rabby, Rainbow, and other SES-using wallets. If the investigation "surfaces" a second wallet, does the scope expand automatically, or does that trigger a re-scoping decision? The PRD says yes-expand (line 29) and also treats it as an open question (line 54).

**9. "Inline vs external" security claim is under-specified.**
- Line 41 says fix must not weaken "CSP, inline-vs-external, no `eval`, etc." but line 53 asks whether externalization "may change SES's enforcement" — a security-relevant property. The PRD needs to state: is moving from inline to external itself a security regression, neutral, or an improvement? Answer determines whether Option 2 is a real candidate or a paper option.

**10. "One combined PR is acceptable" vs "Bundle ... in one PR unless review surfaces a reason to split".**
- Line 42 says "acceptable" (permissive). Line 83 says "unless review surfaces a reason to split" (default-combined). These are almost the same but not quite — "acceptable" leaves splitting equally fine; "unless surfaces a reason" says combined is the default. This is minor but will cause a PR-review debate on whether to split.

**11. Phase A step 2 deliverable location is not specified.**
- "Output a table: feature → count → source map back to TS origin." Where does this table live? Committed to the repo? In the plan bead? In the review doc? If it's part of the "implementation-ready plan" (Goal 5), it needs a home.

**12. "Minor template change" in Goal 2 is undefined.**
- "Deliver a list that survives any future minor template change." Minor in the semver sense? Minor in the subjective-size sense? This phrase is protecting against recurrence but doesn't define what kinds of future edits the inventory must cover. Suggest replacing with "survives any regeneration of the template that does not intentionally change the esbuild target."

### Observations

**13. "Reasonable" / "appropriate" / "as needed" language is mostly absent.** The PRD avoids the worst offenders on this checklist. The vague language that does appear ("sweet spot", "non-trivial", "minor") is flagged above.

**14. "Should/must/could" distinctions are mostly implicit.** Constraints are phrased as "cannot" / "must not" (strong), while Rough Approach is phrased as "do this" without explicit must/should markers. This is fine but the review synthesis should not treat every Phase A/B/C step as a hard requirement — some read as suggested sequencing.

**15. Scenario 4 (wallet ships updated SES) is aspirational, not a user story.** Line 36 describes a post-fix capability to re-raise the target, but this is a future-maintenance note, not a current scenario being designed for. Consider moving to Constraints or a "Future Directions" section to avoid confusion about whether this implies work now.

**16. "Stale local branch" (chore/bump-viem) is mentioned but its status is unclear.** Line 43 says "do NOT build on `chore/bump-viem`." It is not clear whether this branch should be deleted, whether anyone is still committing to it, or whether the polecat needs to verify nothing valuable is stranded there. If it's purely informational ("start from upstream/main, full stop"), say only that.

**17. The mezo/fox field report (hq-wisp-5urev) is a load-bearing unknown.** Open Question 10 asks what was learned but doesn't say whether this review is responsible for digging it up or whether crew fox will provide a summary. The answer could materially change the diagnosis phase.

**18. "Implementation-ready plan" threshold is not defined.** Goal 5 says "crew fox can execute without further research rounds." This is a goal, not a checklist. Does it mean: chosen option named + file paths listed + commands spelled out? Or something lighter? The synthesis step will produce either a 2-page plan or a 10-page plan depending on interpretation.

**19. Phase B asks for "Option 4: anything else surfaced by the research" but gives no structure for it.** If the research surfaces, e.g., a polyfill/preamble option or a feature-detection fallback, does that get promoted to a real Option 4 with the full decision-table treatment, or just mentioned? This is an ambiguity in how the comparison is expected to be structured.

**20. "Phase A — Diagnosis (no code changes yet)" is clear, but the transition to Phase B/C is not time-boxed.** The PRD says Phase A is research; nothing forbids Phase B/C research-only as well. If crew fox is expected to implement immediately after synthesis, someone needs to say so; if the synthesis output itself is the deliverable, Phase C is aspirational, not actual. This is less "ambiguity" than "unclear where the ambiguity review ends and the implementation begins" — worth flagging for the synthesizer.

## Confidence Assessment

**Medium-High.** The PRD is tight enough that most ambiguities are surface-level and resolvable with short clarifications. The three Critical items (regen/fix ordering, ES2020+ vs SES-rejected scope, and the security-asymmetry framing) are real — they will each cause an implementer to make a guess that a reviewer might later reverse. Item 1 is the single most important to resolve because it affects the physical sequence of commits on the branch. Item 2 is the most important for the long-term value of the regression guard. Item 3 is the most important for the review's claim of being decision-neutral.

Nothing in the PRD is internally inconsistent to the point of being unimplementable; everything flagged here is "will cause a debate" rather than "will cause a failure." I have not evaluated other dimensions (completeness, feasibility, risk, scope) — this is ambiguity-only.
