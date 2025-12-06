# Claude Code Guidelines for x402

## Source of Truth

**CRITICAL**: All documentation must be sourced from actual code in this repository.

- The authoritative branch is `upstream/development-v2`
- Before writing ANY documentation, read the actual source files
- NEVER trust training data for x402 APIs - always verify against source code
- Use `git show upstream/development-v2:<filepath>` if you need to check upstream

### Legacy Exclusion Rule

**CRITICAL**: Always exclude `*/legacy/*` paths from all source scanning.

Legacy folders contain V1 implementations that are incompatible with V2 documentation:
- Different API patterns (class instantiation vs registration functions)
- Different import paths
- Deprecated configurations

When scanning with find/grep, always add: `-not -path "*/legacy/*"`

### Key Source Files

```
# OFFICIAL PACKAGE READMEs (PRIMARY)
typescript/packages/core/README.md
typescript/packages/http/express/README.md
typescript/packages/http/fetch/README.md
typescript/packages/http/axios/README.md
typescript/packages/http/hono/README.md
typescript/packages/http/next/README.md
typescript/packages/mechanisms/evm/README.md
typescript/packages/mechanisms/svm/README.md

# E2E REFERENCE IMPLEMENTATIONS (tested, minimal)
# These are the canonical "how to wire up x402" references
e2e/servers/express/index.ts        # Express server setup
e2e/servers/hono/index.ts           # Hono server setup
e2e/servers/next/app/api/           # Next.js route patterns
e2e/clients/fetch/index.ts          # Fetch client setup
e2e/clients/axios/index.ts          # Axios client setup
e2e/facilitators/typescript/        # Facilitator implementation
e2e/extensions/bazaar.ts            # Bazaar extension usage

# EXAMPLES - ADVANCED PATTERNS (feature-rich, production patterns)
# These show advanced use cases beyond basic setup
examples/typescript/servers/advanced/hooks.ts              # Server lifecycle hooks
examples/typescript/servers/advanced/dynamic-price.ts      # Dynamic pricing
examples/typescript/servers/advanced/dynamic-pay-to.ts     # Marketplace routing
examples/typescript/servers/advanced/custom-money-definition.ts  # Custom tokens
examples/typescript/servers/advanced/bazaar.ts             # Bazaar discovery
examples/typescript/clients/advanced/hooks.ts              # Client lifecycle hooks
examples/typescript/facilitator/index.ts                   # Facilitator reference

# EXAMPLES - FULLSTACK PATTERNS
examples/typescript/fullstack/next/                        # Next.js fullstack

# SOURCE CODE (for implementation details)
typescript/packages/http/express/src/index.ts
typescript/packages/http/fetch/src/index.ts
typescript/packages/core/src/server/
typescript/packages/core/src/client/
typescript/packages/core/src/facilitator/
typescript/packages/mechanisms/evm/src/
typescript/packages/mechanisms/svm/src/
typescript/packages/core/src/types/
```

### Source File Categories

| Category | Purpose | Use For |
|----------|---------|---------|
| Package READMEs | Official API docs | Import patterns, basic usage |
| E2E | Tested, minimal implementations | Verified working examples |
| Examples/Advanced | Production patterns | Hooks, dynamic config, marketplace |
| Examples/Fullstack | Complete applications | Next.js, browser integration |
| Source Code | Implementation details | Type definitions, internals |

## Documentation Verification

Run `/verify-docs` to sync with upstream and verify all documentation.

The command:
1. **Syncs** with `upstream/development-v2`
2. **Analyzes** commit history to understand what changed
3. **Detects** stale docs (verified against older commits)
4. **Identifies** novel content in upstream not yet documented
5. **Verifies** each doc against actual source code
6. **Spawns** writer subagents with model escalation (Haiku -> Sonnet -> Opus)
7. **Validates** all internal links, images, and detects orphans
8. **Commits** each verified file with the current commit hash

### Verification Markers

Each verified doc has a marker at the top:
```markdown
<!-- VERIFIED: abc1234 -->
```

This tracks which upstream commit the doc was verified against. When upstream advances, docs become stale and need re-verification.

### Failed Files

Files that fail verification after 3 attempts are saved to `docs/FAILED/` with all attempts included for human review.

### Roadmap Integration

The `/verify-docs` command also checks `ROADMAP.md` in the repository root for updates to planned features. When roadmap items change:

1. **Check `ROADMAP.md`** for timeline changes, new items, or shipped features
2. **Update `docs/09-appendix/roadmap.md`** to reflect current state
3. **Update contextual callouts** in relevant docs using GitHub alert syntax:

```markdown
> [!NOTE]
> **Roadmap: <Item Name>**
> Brief description of planned feature.
> - **Target**: Q4 2025
>
> [View Roadmap](../09-appendix/roadmap.md#section-anchor)
```

Callouts are placed in these docs based on roadmap item impacts:
- `payment-schemes.md` - New payment schemes (upto, commerce, deferred)
- `mechanisms/evm.md` - Arbitrary Token Support, ERC-7710
- `mechanisms/svm.md` - Payments MCP Solana Support
- `mechanisms/README.md` - Sui Support
- `bazaar.md` - A2A, MCP, ERC-8004, Search, External Facilitators
- `architecture-overview.md` - MCP Support, XMTP Support
- `facilitator.md` - CDP Facilitator, Facilitator Router
- `quick-start-facilitator.md` - CDP Facilitator

## User Preferences

- **NO emojis** in documentation unless explicitly requested
- **NO Claude branding** in commits (no "Generated with Claude Code", no Co-Authored-By)
- **Sign commits** with `-s` flag
- **Use Mermaid** for diagrams, never ASCII art
- **TypeScript SDK only** - do not document Go SDK
- **Be YOLO** - proceed without approval unless truly ambiguous

## Writing Style

Write documentation as a DevRel creating excellent developer experience:
- Clear, scannable structure with meaningful headings
- Working code examples developers can copy-paste
- Explain the "why" not just the "what"
- Anticipate common questions and pitfalls
- Progressive disclosure: simple first, details later

## Mermaid Diagram Reference

For diagram syntax, reference: https://gist.github.com/ChristopherA/bffddfdf7b1502215e44cec9fb766dfd

Common diagram types:
- `flowchart LR/TD` - Flow diagrams
- `sequenceDiagram` - Interaction sequences
- `classDiagram` - Class structures

## Commit Messages

Format:
```
<type>: <description>

[optional body]
```

Types: `docs`, `feat`, `fix`, `chore`, `refactor`

Sign with: `git commit -s -m "..."`

## Documentation Structure

```
docs/
├── 00-getting-started/     # Quick starts, installation
├── 01-overview/            # Architecture, concepts
├── 02-protocol-flows/      # Payment flow diagrams
├── 03-sdk-reference/       # Package API docs
├── 04-reference-implementation/  # E2E examples
├── 05-implementation-guide/      # Deep dives
├── 09-appendix/            # Glossary, production
└── FAILED/                 # Failed generation attempts (for human review)
```
