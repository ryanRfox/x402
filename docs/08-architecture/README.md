# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) documenting the key design decisions made in the x402 V2 protocol. Each ADR captures the context, rationale, and consequences of significant architectural choices.

## What are ADRs?

Architecture Decision Records are lightweight documentation that capture important architectural decisions along with their context and consequences. They help teams:

- Understand why certain design choices were made
- Avoid revisiting settled decisions
- Onboard new contributors more effectively
- Evaluate trade-offs when considering changes

## ADR Format

Each ADR follows this structure:

- **Status**: Current state of the decision (Accepted, Deprecated, Superseded)
- **Context**: The issue or challenge being addressed
- **Decision**: The specific choice that was made
- **Consequences**: What becomes easier or harder as a result

## x402 V2 Architecture Decisions

### Core Protocol Design

- [ADR-001: Header-Based Protocol Design](./adr-001-header-based.md)
  - Why x402 V2 uses HTTP headers instead of request/response bodies for payment information

### Component Architecture

- [ADR-002: Facilitator Abstraction Layer](./adr-002-facilitator.md)
  - The benefits of abstracting payment verification and settlement behind a facilitator interface

- [ADR-003: Multi-Network Architecture](./adr-003-multi-network.md)
  - How x402 supports multiple blockchain networks through a unified interface

### Extensibility

- [ADR-004: Extension System Design](./adr-004-extensions.md)
  - The architecture enabling protocol extensions without breaking changes

## Reading Guide

### For New Contributors

Start with ADR-001 to understand the fundamental protocol design, then read ADR-002 and ADR-003 to understand the component architecture.

### For Integration Developers

Focus on ADR-002 (Facilitator) and ADR-003 (Multi-Network) to understand how to integrate x402 into your applications.

### For Protocol Designers

Read all ADRs to understand the complete architectural philosophy and extension points.

## Related Documentation

- [Protocol Overview](../01-overview/what-is-x402.md) - High-level protocol introduction
- [Architecture Overview](../01-overview/architecture-overview.md) - System component relationships
- [Implementation Guide](../05-implementation-guide/README.md) - Technical implementation details
- [SDK Reference](../03-sdk-reference/README.md) - API documentation

## Contributing ADRs

When proposing significant architectural changes:

1. Create a new ADR following the established format
2. Number it sequentially (ADR-005, ADR-006, etc.)
3. Include thorough context and rationale
4. Document trade-offs and consequences honestly
5. Update this README with a link to the new ADR

---

*These ADRs document the x402 V2 protocol architecture as of October 2024.*
