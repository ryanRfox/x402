# Sign-In-With-X (SIWX) Research for x402

This document summarizes research on Sign-In-With-X identity standards and their potential integration with x402.

## The Standard: ERC-4361 (Sign-In with Ethereum / SIWE)

**ERC-4361** is the canonical standard for wallet-based authentication. It was **finalized in August 2025**.

### Key Features

| Feature | Description |
|---------|-------------|
| Self-custodial | Users own their login keys - no centralized identity provider |
| Standardized message | Consistent format with domain, address, nonce, timestamp, expiration |
| Phishing protection | Wallet verifies request origin against domain in message |
| ENS integration | Supports ENS profiles for human-readable identity |
| Cross-chain ready | Message format extensible to other chains (CAIP-10) |

### Message Structure

```
example.com wants you to sign in with your Ethereum account:
0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B

I accept the Example Terms of Service: https://example.com/tos

URI: https://example.com/login
Version: 1
Chain ID: 1
Nonce: 32891756
Issued At: 2025-01-01T00:00:00.000Z
Expiration Time: 2025-01-01T01:00:00.000Z
```

### Security Considerations

- Wallet MUST verify origin matches domain in message
- Nonce prevents replay attacks
- Expiration limits session window
- Statement provides human-readable consent

## What's in the x402 ROADMAP

The x402 team refers to this capability as **"Identity Solution"** rather than explicitly "Sign-In-With-X":

| Timeline | Item | Description |
|----------|------|-------------|
| **Next (Q4/Q1)** | Identity Solution | "Curate best-practice guides and partnerships using existing identity services compatible with x402" |
| **Later (Q1-Q2 2026)** | ERC-8004 Integration | Agent reputation and identity |

**Key philosophy from ROADMAP**:
> "Sellers need KYC/eligibility signals; we won't invent a new identity."

The x402 team wants to integrate existing standards, not create new ones. This makes SIWE/ERC-4361 a natural fit.

## Relevant GitHub Issues and PRs

### Primary: Optimistic Client Identification (#409)

**[Issue #409](https://github.com/coinbase/x402/issues/409)** - Most directly relevant to SIWX

Proposes wallet-based client identification with these use cases:
1. **Retry after failures** - Client already paid but didn't receive response
2. **Long-term purchases** - Permanent access without repeated payments
3. **Tiered pricing** - Different prices for identified vs anonymous clients

Key quote:
> "Sign in with a crypto wallet (providing something signed by a wallet's private key, which identifies it)"

Open questions from the issue:
- How does client know what identification server accepts?
- Should x402 designate "officially supported" auth methods?

### Related Issues

| Issue | Title | Relevance |
|-------|-------|-----------|
| [#476](https://github.com/coinbase/x402/issues/476) | zkTLS Proofs for Payment-Free Access | Alternative identity via ZK proofs |
| [#694](https://github.com/coinbase/x402/issues/694) | Delegated Billing Spec | Pre-authorized payments require identity |
| [#639](https://github.com/coinbase/x402/issues/639) | EIP-4337 Smart Wallet Support | Account abstraction identity |
| [#732](https://github.com/coinbase/x402/pull/732) | Add scheme for ERC-7710 | On-chain delegations for AI agents |

### Gap Identified

**No one has opened a specific ERC-4361/SIWE integration proposal in coinbase/x402 yet.**

This represents a contribution opportunity.

## Related Standards Ecosystem

| Standard | Purpose | Status |
|----------|---------|--------|
| **ERC-4361** | Sign-In with Ethereum (SIWE) | **Final** (Aug 2025) |
| **CAIP-122** | Sign-In with X (chain-agnostic) | Draft |
| **ERC-7846** | Wallet Connection API (combines SIWE) | Draft |
| **ERC-8004** | Trustless Agents | In progress |
| **ERC-7710** | On-chain Delegations | Active |

### CAIP-122: Chain-Agnostic Sign-In

CAIP-122 extends SIWE to other chains:
- Solana (SIWS)
- Cosmos
- Polkadot
- etc.

This would be relevant for x402's multi-chain support (EVM + SVM).

## Potential Integration Points in x402

### 1. Client Identification Header

Add optional identity to x402 payment requests:

```
X-402-Identity: siwe:<base64-encoded-siwe-message>:<signature>
```

### 2. PaymentRequirements Extension

Server indicates accepted identity methods in 402 response:

```json
{
  "accepts": [...],
  "identity": {
    "methods": ["siwe", "bearer"],
    "benefits": {
      "siwe": { "discount": "10%" },
      "bearer": { "discount": "5%" }
    }
  }
}
```

### 3. Facilitator Identity Verification

Facilitator could verify SIWE signatures and attach verified identity to settlement.

### 4. Session-Based Access

After SIWE auth, server issues session token for subsequent requests without payment.

## Sources

- [ERC-4361: Sign-In with Ethereum (Official EIP)](https://eips.ethereum.org/EIPS/eip-4361)
- [SIWE Overview at login.xyz](https://docs.login.xyz/general-information/siwe-overview/eip-4361)
- [ERC-4361 Finalized Announcement (August 2025)](https://etherworld.co/2025/08/06/erc-4361-finalized-what-sign-in-with-ethereum-means-for-ethereum/)
- [ERC-7846: Wallet Connection API](https://eips.ethereum.org/EIPS/eip-7846)
- [Fellowship of Ethereum Magicians Discussion](https://ethereum-magicians.org/t/eip-4361-sign-in-with-ethereum/7263)
- [CAIP-122 Chain-Agnostic Sign-In](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-122.md)

---

## Contribution Opportunity

### Gap Analysis

The x402 ecosystem currently lacks:
1. **Formal SIWE/ERC-4361 integration spec** - No one has proposed this yet
2. **Chain-agnostic identity (CAIP-122)** - Would benefit SVM support
3. **Identity-payment bundling** - Combining auth with micropayments

### How to Contribute

Per the x402 ROADMAP:

1. Open a GitHub Issue titled: `Roadmap: Identity Solution (SIWE/ERC-4361) — Contribution Proposal`
2. Include:
   - Problem statement
   - Proposed approach/design sketch
   - Deliverables and milestones
   - Demo/success criteria
3. The CDP team will review and assign a point-of-contact for consulting

### Suggested Proposal Structure

```markdown
# Roadmap: Identity Solution (SIWE/ERC-4361) — Contribution Proposal

## Problem
x402 currently has no standardized way for clients to identify themselves,
leading to repeated payments, no tiered pricing, and poor retry semantics.

## Proposed Approach
Integrate ERC-4361 (SIWE) as the primary identity mechanism:
1. Define X-402-Identity header format
2. Extend PaymentRequirements with identity hints
3. Add SIWE verification to facilitator
4. Create reference implementation in TypeScript SDK

## Deliverables
- [ ] Specification document in specs/identity/siwe.md
- [ ] TypeScript client identity module
- [ ] TypeScript server identity middleware
- [ ] Facilitator verification support
- [ ] E2E tests demonstrating identity flow
- [ ] Documentation and examples

## Success Criteria
- Client can authenticate once, access multiple paid resources
- Server can offer tiered pricing based on identity
- Retries work without double-charging
```

---

## Deep Research: Subagent Prompt

To perform deeper research on SIWX integration possibilities, use the following prompt with Claude Code's Task tool (subagent_type: "Explore" or "general-purpose"):

### Research Prompt

```
Perform deep research on Sign-In-With-X (SIWX) integration possibilities for the x402 payment protocol. This is a research-only task - do not write any code.

## Research Objectives

1. **ERC-4361 Implementation Patterns**
   - Clone and analyze the official SIWE libraries:
     ```bash
     gh repo clone spruceid/siwe /tmp/siwe
     gh repo clone spruceid/siwe-js /tmp/siwe-js
     ```
   - Document the message parsing, signing, and verification flow
   - Identify how nonce management works
   - Note any security considerations

2. **CAIP-122 Chain-Agnostic Sign-In**
   - Clone the CAIPs repo:
     ```bash
     gh repo clone ChainAgnostic/CAIPs /tmp/caips
     ```
   - Read CAIP-122 specification
   - Document how it extends SIWE to Solana (SIWS) and other chains
   - Assess applicability to x402's SVM support

3. **Existing Integrations to Study**
   - Search for how major projects integrate SIWE:
     ```bash
     gh search repos "siwe middleware" --limit 10
     gh search repos "sign-in ethereum express" --limit 10
     ```
   - Clone 2-3 examples and document their patterns
   - Note how they handle session management after authentication

4. **x402-Specific Integration Points**
   - Read the x402 SDK source to identify where identity could plug in:
     - Client: How would identity be attached to payment requests?
     - Server: How would paymentMiddleware verify identity?
     - Facilitator: Should facilitator validate identity signatures?
   - Consider the interaction between identity and payment flows

5. **Open Questions to Answer**
   - Can SIWE replace payment for certain resources (auth-gated vs pay-gated)?
   - How should identity interact with the `accepts` array in PaymentRequirements?
   - Should identity be per-request or session-based?
   - How does this interact with AI agents (they can't interactively sign)?

6. **Competitive Analysis**
   - How do other micropayment/API-payment protocols handle identity?
   - Search for: Lightning Network LSAT, Unlock Protocol identity, etc.

## Output Format

**Write your findings to: `/Users/fox/Getting Started/x402/.claude/SIWX-DEEP-RESEARCH-REPORT.md`**

Structure the report as:

```markdown
# SIWX Deep Research Report

## Executive Summary
[2-3 paragraph overview of key findings]

## 1. ERC-4361 Implementation Analysis
### Message Format
### Verification Flow
### Nonce Management
### Security Considerations

## 2. CAIP-122 Chain-Agnostic Analysis
### Specification Overview
### Solana (SIWS) Support
### Applicability to x402 SVM

## 3. Existing Integration Patterns
### Pattern 1: [Name]
### Pattern 2: [Name]
### Common Approaches

## 4. x402-Specific Integration Points
### Client Layer
### Server Layer
### Facilitator Layer
### Recommended Architecture

## 5. Open Questions Answered
### Auth-gated vs Pay-gated
### Identity in accepts Array
### Per-request vs Session
### AI Agent Authentication

## 6. Competitive Analysis
### Lightning LSAT
### Unlock Protocol
### Other Approaches

## 7. Recommendations
### Recommended Approach
### Implementation Phases
### Risks

## 8. Next Steps
[Actionable items]

## Appendix: Sources and References
```

## Constraints
- Research only - do not write implementation code
- Clone repos to /tmp for analysis
- Use `gh` CLI for GitHub operations (not WebFetch)
- Focus on patterns applicable to x402's architecture
```

### How to Execute

Run this research using Claude Code:

```
# Option 1: Interactive exploration
Ask Claude: "Research SIWX integration possibilities for x402 using the prompt in .claude/SIWX-RESEARCH.md"

# Option 2: Background agent
Use the Task tool with subagent_type="general-purpose" and the prompt above
```

### Expected Deliverables from Research

The subagent should produce:
1. **Technical analysis** of SIWE/CAIP-122 message formats and verification
2. **Integration patterns** from existing SIWE middleware implementations
3. **x402-specific recommendations** on where/how to add identity support
4. **AI agent considerations** - how non-interactive agents authenticate
5. **Draft specification outline** for x402 SIWE integration

---

## Next Steps

1. [ ] Review this research document
2. [ ] Run deep research subagent (see prompt above)
3. [ ] Draft contribution proposal based on findings
4. [ ] Open issue in coinbase/x402 repository
5. [ ] Engage with CDP team for feedback
