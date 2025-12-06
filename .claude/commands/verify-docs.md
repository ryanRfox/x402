---
description: Sync upstream and verify all x402 documentation against source code
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(mkdir:*), Bash(ls:*), Bash(find:*), Bash(cp:*), Bash(rm:*), Bash(mv:*), Task, Write, Edit
---

# x402 Documentation Verification Workflow

You are an orchestrator/verifier for x402 documentation. This command syncs with upstream, analyzes what changed, and ensures all documentation is accurate and complete.

**Assume you are a clean Claude instance with no prior context.**

## Command Arguments

Check if the user provided arguments after `/verify-docs`:

| Argument | Effect |
|----------|--------|
| `--force` | Re-verify ALL docs regardless of VERIFIED markers |
| `--force-file <path>` | Re-verify specific file(s) regardless of markers |

**Examples:**
- `/verify-docs` - Normal mode (only stale/unverified docs)
- `/verify-docs --force` - Re-verify everything against expanded source files
- `/verify-docs --force-file docs/05-implementation-guide/advanced-patterns.md`

**When to use `--force`:**
- After expanding source file lists in CLAUDE.md or this command
- After modifying verification rules
- To do a full health check of all documentation
- When docs may have drifted without upstream commits

## CRITICAL RULES

1. **Source of truth**: `upstream/development-v2` branch
2. **YOU are the verifier** - Read source files yourself to verify accuracy
3. **Spawn writers** - Use Task tool for rewrites with model escalation
4. **Commit-based tracking** - VERIFIED markers include commit hash
5. **DevRel quality** - Write excellent developer documentation
6. **EXCLUDE LEGACY** - Always skip `*/legacy/*` paths (V1 implementations)

### Legacy Exclusion

**CRITICAL**: Legacy folders contain V1 implementations incompatible with V2 docs.

When scanning files, ALWAYS add: `-not -path "*/legacy/*"`

```bash
# CORRECT - excludes legacy
find e2e -name "*.ts" -not -path "*/legacy/*" -not -path "*/node_modules/*"
find examples/typescript -name "*.ts" -not -path "*/legacy/*"

# WRONG - includes legacy V1 code
find e2e -name "*.ts"
```

V1 vs V2 differences that would corrupt docs:
- V1: `new ExactEvmClient(signer)` class instantiation
- V2: `registerExactEvmScheme(client, { signer })` registration function
- V1: Different import paths, deprecated patterns

---

## Phase 1: Sync with Upstream (Robust Strategy)

Upstream may force-push or have breaking history changes. Use backup-reset-restore strategy:

### 1.1 Backup Local Content

```bash
# Create backup directory
rm -rf /tmp/x402-docs-backup
mkdir -p /tmp/x402-docs-backup

# Backup our content (docs, claude config, memory files)
cp -r docs /tmp/x402-docs-backup/
cp -r .claude /tmp/x402-docs-backup/
cp CLAUDE.md /tmp/x402-docs-backup/
[ -f CLAUDE.local.md ] && cp CLAUDE.local.md /tmp/x402-docs-backup/
```

### 1.2 Fetch and Check for Conflicts

```bash
git fetch upstream
```

**CRITICAL CHECK**: Verify upstream does NOT have a `docs/` folder:
```bash
git ls-tree -d upstream/development-v2 | grep -w docs
```

**If upstream has `docs/` folder: STOP IMMEDIATELY.**
- Alert the user: "Upstream now has a docs/ folder. Human decision required."
- Do not proceed with sync.

### 1.3 Hard Reset to Upstream

```bash
git reset --hard upstream/development-v2
```

### 1.4 Restore Local Content

```bash
# Restore our content
cp -r /tmp/x402-docs-backup/docs .
cp -r /tmp/x402-docs-backup/.claude .
cp /tmp/x402-docs-backup/CLAUDE.md .
[ -f /tmp/x402-docs-backup/CLAUDE.local.md ] && cp /tmp/x402-docs-backup/CLAUDE.local.md .
```

### 1.5 Commit Restoration

```bash
git add docs/ .claude/ CLAUDE.md
[ -f CLAUDE.local.md ] && git add CLAUDE.local.md
git commit -s -m "docs: restore documentation after upstream sync"
```

### 1.6 Get Current Commit

```bash
git rev-parse --short HEAD
```

Store this as `CURRENT_COMMIT` - all verified files will be marked with this.

**Note**: Future pushes to remote will require `git push --force origin <branch>` since history was rewritten.

---

## Phase 2: Analyze Documentation State

### 2.1 Scan All Docs for VERIFIED Markers

Read all files in `docs/` and extract their verification state:

```
<!-- VERIFIED: abc1234 -->
```

Build a list:
- Files with no marker: **UNVERIFIED** (need full verification)
- Files with marker: extract commit hash

### 2.2 Find Oldest Verified Commit

From all VERIFIED markers, find the oldest commit hash. If no files are verified, use the initial commit.

### 2.3 Analyze Commit History

Get the commit log between oldest verified commit and HEAD:

```bash
git log --oneline {OLDEST_COMMIT}..HEAD -- typescript/ examples/ e2e/
```

For significant commits, read the diffs:

```bash
git show {COMMIT_HASH} --stat
git diff {OLDEST_COMMIT}..HEAD -- typescript/packages/
git diff {OLDEST_COMMIT}..HEAD -- e2e/ -- ':!e2e/legacy' ':!e2e/node_modules'
git diff {OLDEST_COMMIT}..HEAD -- examples/typescript/ -- ':!examples/typescript/legacy'
```

**Note**: The `:!path` syntax excludes paths from git diff. Always exclude legacy folders.

### 2.4 Categorize Changes

From the commit analysis, identify:
- **API changes**: Modified function signatures, new parameters, renamed exports
- **New features**: New packages, new capabilities, new integrations
- **Breaking changes**: Removed APIs, changed behavior
- **Bug fixes**: Corrections that might affect documented examples

---

## Phase 3: Determine Work Scope

### 3.1 Stale Documents

**If `--force` flag was provided:**
- Treat ALL documents as stale (ignore VERIFIED markers)
- This ensures every doc is re-verified against the expanded source file list

**If `--force-file <path>` was provided:**
- Treat only the specified file(s) as stale
- Other files use normal staleness detection

**Normal mode (no flags):**
A document is **stale** if:
- It has no VERIFIED marker, OR
- Its VERIFIED commit is older than HEAD AND upstream changes affect its content

### 3.2 Novel Content Detection

Compare upstream capabilities with existing docs.

**REMINDER**: Exclude `*/legacy/*` from all scans.

#### 3.2.1 Package Coverage

```bash
# List all packages
ls typescript/packages/
ls typescript/packages/core
ls typescript/packages/extensions
ls typescript/packages/http/
ls typescript/packages/mechanisms/
```

Check if each is documented in `docs/03-sdk-reference/`.

#### 3.2.2 E2E Coverage

```bash
# List e2e implementations (excluding legacy)
find e2e/servers -maxdepth 1 -type d -not -path "*/legacy/*"
find e2e/clients -maxdepth 1 -type d -not -path "*/legacy/*"
```

Check if each server/client framework is documented in `docs/`.

#### 3.2.3 Advanced Pattern Coverage

```bash
# List advanced patterns (excluding legacy)
ls examples/typescript/servers/advanced/
ls examples/typescript/clients/advanced/
```

For each advanced pattern, check if documented:
- `hooks.ts` → Should have lifecycle hooks documentation
- `dynamic-price.ts` → Should have dynamic pricing documentation
- `dynamic-pay-to.ts` → Should have marketplace routing documentation
- `custom-money-definition.ts` → Should have custom tokens documentation
- `bazaar.ts` → Should have Bazaar setup documentation

#### 3.2.4 Fullstack Coverage

```bash
# List fullstack examples (excluding legacy)
ls examples/typescript/fullstack/
```

Check if fullstack patterns are documented.

#### 3.2.5 Novel Content Placement

**If something exists upstream but not in docs, create a new doc file.**

| Source Location | Target Documentation |
|-----------------|---------------------|
| `typescript/packages/*` | `docs/03-sdk-reference/` |
| `e2e/servers/*`, `e2e/clients/*` | `docs/04-reference-implementation/` |
| `examples/typescript/servers/advanced/*` | `docs/05-implementation-guide/` |
| `examples/typescript/clients/advanced/*` | `docs/05-implementation-guide/` |
| `examples/typescript/fullstack/*` | `docs/04-reference-implementation/` |

---

## Phase 4: Read Source Files

Before ANY verification, read the current source to understand actual APIs.

**REMINDER**: Exclude all `*/legacy/*` paths when scanning.

### 4.1 Package READMEs (Primary API Reference)

```
typescript/packages/core/README.md
typescript/packages/http/express/README.md
typescript/packages/http/fetch/README.md
typescript/packages/http/axios/README.md
typescript/packages/http/hono/README.md
typescript/packages/http/next/README.md
typescript/packages/mechanisms/evm/README.md
typescript/packages/mechanisms/svm/README.md
```

### 4.2 E2E Reference Implementations (Tested, Minimal)

These are canonical "how to wire up x402" references - tested in CI.

```bash
# Scan all e2e source files (excluding legacy and node_modules)
find e2e -name "*.ts" -not -path "*/legacy/*" -not -path "*/node_modules/*"
```

Key files to read:
```
e2e/servers/express/index.ts        # Express server setup
e2e/servers/hono/index.ts           # Hono server setup
e2e/servers/next/app/api/           # Next.js route patterns (proxy, withX402)
e2e/clients/fetch/index.ts          # Fetch client setup
e2e/clients/axios/index.ts          # Axios client setup
e2e/facilitators/typescript/        # Facilitator implementation
e2e/extensions/bazaar.ts            # Bazaar extension usage
```

### 4.3 Examples - Advanced Patterns (Production-Ready)

These show advanced use cases beyond basic setup.

```bash
# Scan examples (excluding legacy)
find examples/typescript -name "*.ts" -not -path "*/legacy/*" -not -path "*/node_modules/*"
```

Key files to read:
```
# Server advanced patterns
examples/typescript/servers/advanced/hooks.ts              # Lifecycle hooks
examples/typescript/servers/advanced/dynamic-price.ts      # Dynamic pricing
examples/typescript/servers/advanced/dynamic-pay-to.ts     # Marketplace routing
examples/typescript/servers/advanced/custom-money-definition.ts  # Custom tokens
examples/typescript/servers/advanced/bazaar.ts             # Bazaar discovery

# Client advanced patterns
examples/typescript/clients/advanced/hooks.ts              # Client lifecycle hooks
examples/typescript/clients/advanced/preferred-network.ts  # Network selection

# Facilitator reference
examples/typescript/facilitator/index.ts

# Fullstack patterns
examples/typescript/fullstack/next/                        # Next.js integration
```

### 4.4 Source Code (Implementation Details)

For type definitions and internals:
```
typescript/packages/http/express/src/index.ts
typescript/packages/http/fetch/src/index.ts
typescript/packages/core/src/types/
typescript/packages/core/src/server/
typescript/packages/core/src/client/
typescript/packages/core/src/facilitator/
```

### 4.5 Extract and Memorize

From the source files, extract:
- Import statements and package names
- Function/class signatures
- Configuration object shapes
- Route configuration format
- Lifecycle hook patterns
- Dynamic configuration patterns

---

## Phase 5: Process Documents

For each document needing work (stale, unverified, or novel):

### 5.0 Read Existing Doc First

**Before verification, read the COMPLETE existing doc:**

1. Read the entire doc into context
2. Identify its structure (sections, headings)
3. Note what claims it makes about APIs
4. Understand what source files it references

This establishes the "current version" baseline for comparison.

### 5.1 Map Sections to Source Files

For each section in the doc, identify which source file(s) it should match:

| Doc Section | Source Files to Check |
|-------------|----------------------|
| Installation | Package README, package.json |
| Quick Start / Usage | e2e/servers/*, e2e/clients/* |
| API Reference | Source exports, type definitions |
| Configuration | Route config in e2e/*, examples/* |
| Examples | examples/typescript/*, e2e/* |
| Advanced Patterns | examples/typescript/*/advanced/* |

### 5.2 Section-by-Section Verification

For EACH section, verify against its mapped source files:

```
┌─────────────────────────────────────────────────────────┐
│ Section: "## Server Lifecycle Hooks"                     │
├─────────────────────────────────────────────────────────┤
│ Source: examples/typescript/servers/advanced/hooks.ts   │
├─────────────────────────────────────────────────────────┤
│ Checklist:                                               │
│ - [ ] Hook names match source (onBeforeVerify, etc.)    │
│ - [ ] Signature matches source                           │
│ - [ ] Return types documented correctly                  │
│ - [ ] Example code matches source pattern                │
├─────────────────────────────────────────────────────────┤
│ Result: PASS / FAIL                                      │
│ Issues: {specific problems if FAIL}                      │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Verification Checklist (Per Section)

- [ ] Import statements match actual package exports
- [ ] Function/class names match source exactly
- [ ] API signatures match implementation
- [ ] Configuration object structure is correct
- [ ] No invented or hallucinated APIs
- [ ] Uses Mermaid for diagrams (not ASCII art)
- [ ] No emojis
- [ ] All internal links resolve
- [ ] Code examples are complete and runnable
- [ ] Terminology matches glossary (see STYLE-GUIDE.md)

### 5.4 Determine Fix Strategy

Based on section-level results:

| Outcome | Strategy |
|---------|----------|
| All sections PASS | Update VERIFIED marker only |
| >50% sections PASS | Patch failed sections only |
| <50% sections PASS | Full doc rewrite |
| Novel doc (no existing) | Full doc write |

### 5.5 If PASS (all sections)

Update the VERIFIED marker with current commit:

```markdown
<!-- VERIFIED: {CURRENT_COMMIT} -->
```

Commit:
```bash
git add {filepath}
git commit -s -m "docs: verify {filename}"
```

### 5.6 If PARTIAL FAIL (>50% sections pass)

For docs where most sections pass but some fail:

1. **Keep passing sections unchanged**
2. **Spawn writer for ONLY failed sections**
3. **Provide writer with:**
   - The specific sections to rewrite
   - The passing sections as context (DO NOT MODIFY)
   - Source files for failed sections
   - Specific issues found

Writer prompt addition for partial fixes:
```
## PARTIAL REWRITE

Only rewrite these sections:
- {section name}: {specific issues}
- {section name}: {specific issues}

DO NOT MODIFY these sections (they passed verification):
- {list of passing sections}

Maintain consistent voice and terminology with passing sections.
```

### 5.7 If FULL FAIL (<50% sections pass or novel doc)

Spawn a writer subagent for full doc. Use the Writer Prompt Template below.

**Model Escalation:**
| Attempt | Writer Model |
|---------|--------------|
| 1       | haiku        |
| 2       | sonnet       |
| 3       | opus         |

After 3 failures, save to `docs/FAILED/` (see Failure Handling below).

---

## Writer Prompt Template

When spawning a writer subagent, use the **guided-reader approach**: tell the writer which files to read, don't paste content.

### Prompt Structure

```
You are a DevRel technical writer creating excellent developer documentation for x402.

## YOUR ROLE

Write documentation that developers love:
- Clear, scannable structure with meaningful headings
- Working code examples they can copy-paste
- Explain the "why" not just the "what"
- Anticipate common questions and pitfalls
- Progressive disclosure: simple first, details later

## TASK

Write/rewrite documentation for: {FILE_PATH}

## FILES TO READ (use Read tool)

You MUST read these source files to understand the actual API patterns:

### Package READMEs
{list relevant package READMEs}

### E2E Reference Implementations
{list relevant e2e files, e.g.:}
- e2e/servers/express/index.ts
- e2e/clients/fetch/index.ts

### Advanced Examples
{list relevant examples, e.g.:}
- examples/typescript/servers/advanced/hooks.ts
- examples/typescript/servers/advanced/dynamic-price.ts

### Source Code (if needed for types/internals)
{list relevant source files}

## DO NOT READ - CRITICAL

**NEVER read any path containing `/legacy/`** - these are V1 implementations with incompatible patterns:
- V1: `new ExactEvmClient(signer)` ← WRONG
- V2: `registerExactEvmScheme(client, { signer })` ← CORRECT

## STYLE GUIDE

Read `docs/STYLE-GUIDE.md` for terminology, voice, and formatting rules.

Key requirements:
- Use exact terminology from glossary (x402Client, not "x402 client")
- V2 patterns only (registerExactEvmScheme, not new ExactEvmClient)
- CAIP-2 network format (eip155:84532, not "Base Sepolia")
- Mermaid for diagrams (https://gist.github.com/ChristopherA/bffddfdf7b1502215e44cec9fb766dfd)
- No ASCII art, no emojis
- Complete imports in all code examples
- Second person, active voice

## REQUIREMENTS

1. Read the source files above FIRST before writing
2. Read docs/STYLE-GUIDE.md for terminology and formatting
3. All code MUST match patterns found in the source files EXACTLY
4. Use Mermaid for diagrams (no ASCII art)
5. No emojis
6. Complete import statements in ALL code examples
7. Include practical, working examples
8. Link to related docs where helpful

## PREVIOUS ATTEMPT FEEDBACK (if retry)

{PASTE_VERIFIER_FEEDBACK_FROM_FAILED_ATTEMPT}

## OUTPUT

Return the complete markdown file content with `<!-- VERIFIED: {COMMIT} -->` marker at top.
```

### Model Escalation

| Attempt | Model | When to Use |
|---------|-------|-------------|
| 1 | haiku | First attempt - cheapest |
| 2 | sonnet | After haiku fails verification |
| 3 | opus | After sonnet fails verification |

### Spawning Writers

```
Task tool:
- subagent_type: "general-purpose"
- model: "haiku" | "sonnet" | "opus" (based on attempt number)
- prompt: (use template above)
```

### Key Differences from Pasted-Content Approach

| Aspect | Old (Pasted) | New (Guided) |
|--------|--------------|--------------|
| Source access | Only what coordinator pastes | Writer reads files directly |
| Independence | Trusts coordinator's interpretation | Verifies against actual source |
| Completeness | Limited by prompt size | Full file access |
| Legacy safety | Coordinator must filter | Explicit DO NOT READ rule |

---

## Phase 6: Link Validation

After processing all documents, validate all links:

### 6.1 Internal Links

Find all markdown links in `docs/`:
```bash
grep -r '\[.*\](\..*\.md)' docs/
grep -r '\[.*\](#' docs/
```

For each link, verify the target exists:
- Relative file links: check file exists
- Anchor links: check heading exists in target file

### 6.2 External Links

Find external URLs:
```bash
grep -rE '\[.*\]\(https?://' docs/
```

Note: External link validation is informational only (may have false positives).

### 6.3 Orphan Detection

Find files in `docs/` that are not linked from anywhere:
```bash
# List all doc files
find docs -name "*.md" -type f

# For each, check if it's linked from another doc
```

Report orphans for human review.

### 6.4 Image/Asset Links

```bash
grep -rE '!\[.*\]\(' docs/
```

Verify all referenced images exist.

### 6.5 Cross-Document Consistency

Ensure terminology and patterns are consistent across all docs.

#### 6.5.1 Load Style Guide

Read `docs/STYLE-GUIDE.md` for terminology rules.

#### 6.5.2 Terminology Scan

For each verified doc, check:

```bash
# Find non-standard terminology
grep -i "x402 client" docs/    # Should be x402Client
grep -i "resource server" docs/ # Should be x402ResourceServer
grep -i "facilitator class" docs/ # Should be x402Facilitator
```

Check for V1 patterns that shouldn't exist:
```bash
grep "new ExactEvmClient" docs/     # V1 - should not exist
grep "new ExactEvmServer" docs/     # V1 - should not exist
```

#### 6.5.3 Cross-Reference Verification

For concepts defined in multiple docs, verify consistency:

| Concept | Authoritative Source | Check Against |
|---------|---------------------|---------------|
| Component names | glossary.md | All docs |
| Hook names | advanced-patterns.md | implementation-guide/*.md |
| Network identifiers | appendix/README.md | All code examples |
| Header names | glossary.md | All docs |

#### 6.5.4 Code Pattern Consistency

Verify all code examples use the same patterns:

1. **Import style**: All use named imports from subpaths
2. **Registration pattern**: All use `registerExactEvmScheme()` not class instantiation
3. **Network format**: All use CAIP-2 (`eip155:84532` not `84532`)

#### 6.5.5 Report Inconsistencies

If inconsistencies found:
- Log in summary report
- Do NOT auto-fix (may be intentional variations)
- Flag for human review

### 6.6 Broken Link Repair

For each broken internal link found in 6.1:

#### 6.6.1 Attempt Auto-Repair

```
Broken link: [Server Guide](./server-guide.md)
Target not found: docs/03-sdk-reference/server-guide.md
```

**Search for renamed/moved file:**
```bash
# Search by filename pattern
find docs -name "*server*guide*.md" -o -name "*server*.md"

# Search by content (find where that content went)
grep -rl "x402ResourceServer" docs/
```

#### 6.6.2 Auto-Fix If Match Found

If exactly ONE candidate found:
```bash
# Update the link in the source file
# Example: ./server-guide.md → ./server-implementation.md
```

Commit the fix:
```bash
git add {source_file}
git commit -s -m "docs: fix broken link to {target}"
```

#### 6.6.3 Flag If Ambiguous

If ZERO or MULTIPLE candidates found:
- Add to summary report under "Broken Links (needs human review)"
- Include the source file, broken link, and any candidates found

### 6.7 Orphan Handling

For each orphan file found in 6.3:

#### 6.7.1 Verify Truly Orphaned

Check if the file is:
- A README.md (index files are often entry points, not linked)
- Referenced in CLAUDE.md or other config files
- The STYLE-GUIDE.md or other meta-docs

**Skip these - they're intentionally standalone:**
```
docs/STYLE-GUIDE.md
docs/*/README.md
docs/FAILED/*.md
```

#### 6.7.2 Move to ORPHANED/

For truly orphaned files:
```bash
mkdir -p docs/ORPHANED

# Move with timestamp
mv docs/path/to/orphan.md docs/ORPHANED/orphan-241206.md
```

#### 6.7.3 Add Orphan Header

Insert at top of moved file:
```markdown
<!-- ORPHANED: 2024-12-06 -->
<!-- Original location: docs/path/to/orphan.md -->
<!-- Reason: No incoming links from other docs -->
<!--
OPTIONS:
1. Delete if content is obsolete
2. Link from appropriate parent doc
3. Merge content into another doc
-->
```

Commit:
```bash
git add docs/ORPHANED/
git commit -s -m "docs: move orphaned file {filename} for review"
```

#### 6.7.4 Orphan Exceptions

**Never move these to ORPHANED:**
- Files in `docs/FAILED/` (already flagged)
- Files in `docs/ORPHANED/` (already processed)
- `README.md` files (section indexes)
- `STYLE-GUIDE.md` (meta-documentation)

---

## Phase 7: Failure Handling

When a writer subagent's output fails verification, preserve the failed attempt:

### 7.1 Move Failed File to FAILED/

```bash
# Create FAILED directory if needed
mkdir -p docs/FAILED

# Move the failed file with timestamp and model suffix
# Format: {filename}-{YYMMDD}-{HHMM}-{model}.md
mv docs/path/to/file.md docs/FAILED/file-241206-1423-haiku.md
```

### 7.2 Insert Verifier Feedback

At the top of the failed file, insert verification feedback:

```markdown
<!-- FAILED VERIFICATION -->
<!-- Model: haiku -->
<!-- Timestamp: 2024-12-06 14:23 -->
<!-- Verified Against: {CURRENT_COMMIT} -->
<!--
VERIFIER FEEDBACK:
- {specific issue 1}
- {specific issue 2}
- {what was expected}

SOURCE FILES CHECKED:
- e2e/servers/express/index.ts (line 23 shows correct pattern)
- examples/typescript/servers/advanced/hooks.ts

PROMPT FOR NEXT MODEL:
{specific instructions for the next model to fix these issues}
-->

{original content generated by the subagent}
```

### 7.3 Escalation Flow

For each doc that needs writing:

1. **Haiku attempt** → If FAIL:
   - Move to `docs/FAILED/{name}-{timestamp}-haiku.md`
   - Insert feedback
   - Spawn Sonnet with feedback

2. **Sonnet attempt** → If FAIL:
   - Move to `docs/FAILED/{name}-{timestamp}-sonnet.md`
   - Insert feedback
   - Spawn Opus with feedback

3. **Opus attempt** → If FAIL:
   - Move to `docs/FAILED/{name}-{timestamp}-opus.md`
   - Insert feedback
   - Log in summary report as needing human review

4. **On SUCCESS at any stage**:
   - Keep the successful file in place
   - Update VERIFIED marker
   - Failed attempts remain in FAILED/ for analysis

### 7.4 FAILED/ Folder Structure

```
docs/FAILED/
├── advanced-patterns-241206-1423-haiku.md    # Haiku failed
├── advanced-patterns-241206-1425-sonnet.md   # Sonnet also failed
├── advanced-patterns-241206-1427-opus.md     # Opus also failed (needs human)
├── evm-241206-1430-haiku.md                  # Haiku failed, Sonnet succeeded
└── ...
```

This preserves ALL failed attempts for human evaluation, showing:
- Which models struggle with which docs
- What patterns cause failures
- Whether escalation is worth the cost

---

## Phase 8: Summary Report

After all processing, output a summary:

```
## Verification Summary

**Upstream:** {CURRENT_COMMIT}
**Previous oldest verified:** {OLDEST_COMMIT}
**Commits analyzed:** {COUNT}

### Documents Processed
| Category | Count |
|----------|-------|
| Verified (unchanged) | {count} |
| Verified (partial rewrite) | {count} |
| Verified (full rewrite) | {count} |
| Created (novel) | {count} |
| Failed (needs human) | {count} |

### Failed Files (need human review)
Location: docs/FAILED/
- {name}-{timestamp}-{model}.md

### Link Repairs
| Status | Count |
|--------|-------|
| Auto-fixed | {count} |
| Needs human review | {count} |

**Unresolved broken links:**
- {source_file}: [{link_text}]({broken_path}) → candidates: {list or "none found"}

### Orphan Handling
| Status | Count |
|--------|-------|
| Moved to ORPHANED/ | {count} |
| Skipped (README/meta) | {count} |

**Moved files:**
- docs/ORPHANED/{filename}-{date}.md (was: {original_path})

### Consistency Issues
- Terminology violations: {count}
- V1 pattern usage: {count}

### Novel Content Added
- {list of new files created}

### Missing Images
- {list of broken image references}
```

---

## Processing Order

**IMPORTANT**: YOU (the main instance) are the verifier. Process docs SEQUENTIALLY in the order below. Only spawn Task agents for WRITING when a doc needs rewrite - never for verification.

### Why Sequential?

1. Earlier docs establish terminology used by later docs
2. Cross-doc consistency requires single-threaded context
3. Link validation needs all docs processed to detect orphans
4. Reduces duplicate source file reads

### Execution Model

```
YOU (coordinator/verifier)
  │
  ├── Read source files ONCE (Phase 4)
  │
  ├── For each doc in order:
  │   ├── Read existing doc (Phase 5.0)
  │   ├── Verify sections against source (Phase 5.1-5.3)
  │   ├── If PASS: update marker
  │   ├── If PARTIAL FAIL: spawn writer for failed sections only
  │   └── If FULL FAIL: spawn writer with model escalation
  │
  └── After all docs: link validation, orphan handling (Phase 6)
```

### Document Order

Process in this exact order (dependencies flow downward):

**Phase A: Reference Material (defines vocabulary)**
```
docs/STYLE-GUIDE.md
docs/09-appendix/glossary.md
docs/05-implementation-guide/types-and-interfaces.md
```

**Phase B: Foundational Concepts**
```
docs/01-overview/README.md
docs/01-overview/what-is-x402.md
docs/01-overview/architecture-overview.md
docs/01-overview/use-cases.md
```

**Phase C: Protocol Understanding**
```
docs/02-protocol-flows/README.md
docs/02-protocol-flows/payment-flow-overview.md
docs/02-protocol-flows/happy-path.md
docs/02-protocol-flows/error-scenarios.md
docs/02-protocol-flows/network-variations.md
```

**Phase D: Getting Started (references concepts)**
```
docs/00-getting-started/README.md
docs/00-getting-started/installation.md
docs/00-getting-started/quick-start-client.md
docs/00-getting-started/quick-start-server.md
docs/00-getting-started/quick-start-facilitator.md
```

**Phase E: SDK Reference (references getting started)**
```
docs/03-sdk-reference/README.md
docs/03-sdk-reference/core/README.md
docs/03-sdk-reference/core/*.md (alphabetically)
docs/03-sdk-reference/http-adapters/README.md
docs/03-sdk-reference/http-adapters/*.md (alphabetically)
docs/03-sdk-reference/mechanisms/README.md
docs/03-sdk-reference/mechanisms/*.md (alphabetically)
docs/03-sdk-reference/extensions/README.md
docs/03-sdk-reference/extensions/*.md (alphabetically)
```

**Phase F: Reference Implementation**
```
docs/04-reference-implementation/README.md
docs/04-reference-implementation/architecture.md
docs/04-reference-implementation/client-architecture.md
docs/04-reference-implementation/server-architecture.md
docs/04-reference-implementation/facilitator-architecture.md
```

**Phase G: Implementation Guide (advanced)**
```
docs/05-implementation-guide/README.md
docs/05-implementation-guide/client-implementation.md
docs/05-implementation-guide/server-implementation.md
docs/05-implementation-guide/facilitator-implementation.md
docs/05-implementation-guide/payment-schemes.md
docs/05-implementation-guide/advanced-patterns.md
```

**Phase H: Remaining Appendix**
```
docs/09-appendix/README.md
docs/09-appendix/environment-setup.md
docs/09-appendix/running-tests.md
docs/09-appendix/production.md
docs/09-appendix/roadmap.md
```

### Handling New Files

If a file exists in `docs/` but isn't in this list:
1. Process it at the END of its parent folder's phase
2. Log in summary: "New file detected: {path} - consider adding to processing order"

---

## GO MODE

Process autonomously. Only stop if:
- Cannot sync with upstream (network/permission issue)
- Source files missing or unreadable
- Conflicting patterns found in source code

Otherwise: sync -> analyze -> read source -> verify/write -> validate links -> commit -> report

**Begin now. Start with Phase 1: Sync with Upstream.**
