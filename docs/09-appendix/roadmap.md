<!-- VERIFIED: 0aa62c64 -->
# Roadmap

This page summarizes the x402 public roadmap. For the full roadmap with contribution guidelines, see [ROADMAP.md](https://github.com/coinbase/x402/blob/main/ROADMAP.md) in the repository root.

## How to Contribute

1. Pick a "Community" item below
2. Open a [GitHub Issue](https://github.com/coinbase/x402/issues/new) titled `Roadmap: <item> - Contribution Proposal`
3. Include: goals, approach, deliverables, timeline, and success metrics
4. The CDP team will review and provide consulting support

## Recently Shipped

### x402 Bazaar Launch
Service discovery for x402-compatible APIs.

- **Shipped**: September 2025
- **What**: Machine-readable catalog enabling discovery and integration of x402 endpoints
- **Docs**: [Bazaar Extension](../03-sdk-reference/extensions/bazaar.md)
- **Community**: Contribute endpoint listings, discovery standards, example clients

---

## Now (In Progress)

### Usage-Based Payment Scheme
Post-computed, per-call pricing for metered APIs.

- **Target**: Early Q4 2025
- **Why**: Current spec favors pre-negotiated access; APIs need usage-based pricing (e.g., LLM token costs)
- **What**: Formalize `upto` scheme for usage-based payments
- **Impacts**: [Payment Schemes](../05-implementation-guide/payment-schemes.md)
- **Community**: Feedback on spec design, reference contracts, demo integrations

### MCP Support in x402 Spec
Model Context Protocol integration patterns.

- **Target**: Q4 2025
- **Why**: Standardize how MCP tools interact with x402 payments
- **What**: Include MCP norms within the x402 specification
- **Impacts**: [Architecture Overview](../01-overview/architecture-overview.md)
- **Community**: Co-design and reference repos (great fit for contributors)

---

## Next (Queued)

### Open-Source CDP Facilitator
Production-grade reference facilitator implementation.

- **Target**: Q4 2025
- **Why**: Teams need a production-ready facilitator reference as the ecosystem grows
- **What**: Share CDP's Server Wallet-based facilitator (Go or TypeScript)
- **Impacts**: [Facilitator Implementation](../05-implementation-guide/facilitator-implementation.md), [Facilitator Quick Start](../00-getting-started/quick-start-facilitator.md)
- **Community**: Runtime hardening, adapters, deployment recipes

### Bazaar: External Facilitator Endpoints
Allow third-party facilitators to register endpoints in Bazaar.

- **Target**: Q4 2025
- **Why**: Multiple facilitators have endpoints not discoverable in Bazaar
- **What**: Mechanism (via CDP API keys) to register external endpoints
- **Impacts**: [Bazaar Extension](../03-sdk-reference/extensions/bazaar.md)

### Payments MCP: Remote URL Support
Enable browser-based MCP clients.

- **Target**: Q4/Q1 2026
- **Why**: Current MCP works best in desktop apps; remote URLs enable Claude/ChatGPT web clients
- **What**: Spec and implementation for remote URL flows
- **Note**: Must be built by CDP team (close-sourced, Coinbase infrastructure)

### Payments MCP: Solana Support
Multi-chain agentic finance hub.

- **Target**: Q4/Q1 2026
- **Why**: Make Payments MCP support multiple chains
- **What**: Add Solana wallet support via CDP SDK
- **Impacts**: [SVM Mechanism](../03-sdk-reference/mechanisms/svm.md)
- **Community**: Example endpoints and wallet adapters

### A2A Support in Bazaar
Discover and call A2A agents from x402 clients.

- **Target**: Q4/Q1 2026
- **Why**: Bazaar lists endpoints but not A2A agents
- **What**: Agent discovery with input schemas and execution support
- **Impacts**: [Bazaar Extension](../03-sdk-reference/extensions/bazaar.md)
- **Community**: Schemas, validators, starter clients

### Identity Solution
KYC and eligibility signals for sellers.

- **Target**: Late Q4/Q1 2026
- **Why**: Sellers need identity verification; x402 won't invent a new identity protocol
- **What**: Curate best-practice guides and partnerships with existing identity services
- **Impacts**: [Production Deployment](./production.md)
- **Community**: Guide PRs, integrator demos, comparison matrices (great fit)

### MCP Support in Bazaar
Surface MCP tools alongside API endpoints.

- **Target**: Q4/Q1 2026
- **Why**: Enable discovery of MCP tools from x402 clients
- **What**: Tool discovery schemas and execution support
- **Impacts**: [Bazaar Extension](../03-sdk-reference/extensions/bazaar.md)
- **Community**: Tool discovery schemas, example bridges

---

## Later (Future)

### ERC-8004 Integration
Trustless Agents standard for agent reputation and identity.

- **Target**: Q1-Q2 2026
- **Why**: Align with Ethereum's emerging agent standards
- **What**: Integrate ERC-8004 as it matures
- **Impacts**: [Bazaar Extension](../03-sdk-reference/extensions/bazaar.md)
- **Community**: Research, examples, spec contributions

### Commerce Scheme
Refunds and escrow flows for e-commerce.

- **Target**: Q1 2026
- **Why**: E-commerce needs refund and escrow capabilities
- **What**: Define and pilot a commerce payment scheme
- **Impacts**: [Payment Schemes](../05-implementation-guide/payment-schemes.md)

### Arbitrary Token Support
Support for non-EIP-3009 tokens via Permit/Permit2.

- **Target**: Q2 2026
- **Why**: Only EIP-3009 tokens (USDC) are seamless today
- **What**: Permit, Permit2, and EIP-712 flows for other tokens
- **Impacts**: [EVM Mechanism](../03-sdk-reference/mechanisms/evm.md)
- **Community**: Spec proposal and reference implementation (great fit)

### XMTP Support
First-class XMTP messaging integration.

- **Target**: Q2 2026
- **Why**: Base App agents rely on XMTP
- **What**: Include XMTP in x402 spec and packages
- **Impacts**: [Architecture Overview](../01-overview/architecture-overview.md)
- **Community**: Co-author spec, provide adapters/examples (great fit)

### Facilitator Router
Multi-network/scheme/token routing.

- **Target**: Late Q2 2026
- **Why**: Sellers need coverage across networks, schemes, and tokens
- **What**: Router that selects appropriate facilitator per configuration
- **Impacts**: [Facilitator Module](../03-sdk-reference/core/facilitator.md)
- **Community**: Prototypes and routing benchmarks

### Bazaar Search and Categorization
Search, categories, and ranking for Bazaar listings.

- **Target**: TBD (when scale merits)
- **Why**: Discovery becomes harder as listings grow
- **What**: Add search, categories, and ranking signals
- **Impacts**: [Bazaar Extension](../03-sdk-reference/extensions/bazaar.md)
- **Community**: Indexers, ranking heuristics, UI PRs (great fit)

### Sui Support
Sui blockchain integration.

- **Target**: TBD
- **Why**: Expand chain coverage
- **What**: Sui support in packages and facilitator
- **Impacts**: [Payment Mechanisms](../03-sdk-reference/mechanisms/README.md)
- **Community**: Community-driven contribution

### ERC-7710 On-Chain Delegations
On-chain delegation support.

- **Target**: TBD
- **Why**: Enable on-chain permission delegation
- **What**: ERC-7710 integration
- **Impacts**: [EVM Mechanism](../03-sdk-reference/mechanisms/evm.md)
- **Community**: Community-driven contribution

### Deferred Payment Scheme
Deferred/delayed payment flows.

- **Target**: TBD
- **Why**: Enable pay-later use cases
- **What**: New payment scheme for deferred settlement
- **Impacts**: [Payment Schemes](../05-implementation-guide/payment-schemes.md)
- **Community**: Working with existing community builder

---

## Community Contribution Opportunities

These items are especially well-scoped for community ownership:

| Item | Type | Difficulty |
|------|------|------------|
| Arbitrary Token Support | Spec + Implementation | Medium |
| XMTP Support | Spec + Packages | Medium |
| Identity Solution Guides | Documentation | Easy |
| Solution Guides & Demos | Documentation | Easy |
| MCP Support in Spec | Spec + Reference | Medium |
| Sui Support | Implementation | Medium |
| ERC-7710 Delegations | Implementation | Medium |
| Deferred Payment Scheme | Spec + Implementation | Hard |
| Bazaar Search/Indexing | Implementation | Medium |

To claim an item:
1. Open a [GitHub Issue](https://github.com/coinbase/x402/issues/new) titled `Roadmap: <item> - Contribution Proposal`
2. Include problem statement, proposed approach, milestones, and demo plan
3. CDP team will assign a point-of-contact for consulting

---

## See Also

- [Full Roadmap (ROADMAP.md)](https://github.com/coinbase/x402/blob/main/ROADMAP.md)
- [GitHub Issues](https://github.com/coinbase/x402/issues)
- [GitBook Documentation](https://github.com/murrlincoln/x402-gitbook) (community-owned)
