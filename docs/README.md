# x402 Protocol v2 - Complete Documentation

Welcome to the comprehensive documentation for the x402 payment protocol version 2. This documentation is based on the reference implementations found in the `/e2e` directory and provides a complete guide from high-level concepts to implementation details.

## 📚 Documentation Structure

This documentation is organized to progressively deepen your understanding, starting from concepts and moving toward implementation details.

### [00 - Getting Started](./00-getting-started/)

**Quick start guides** to get you up and running in under 10 minutes.

- [Installation & Setup](./00-getting-started/installation.md) - Environment configuration and dependencies
- [Client Quick Start](./00-getting-started/quick-start-client.md) - Make your first paid API request
- [Server Quick Start](./00-getting-started/quick-start-server.md) - Protect your endpoints with payments

### [01 - Overview](./01-overview/)

**Start here** if you're new to x402 or want to understand the big picture.

- [What is x402?](./01-overview/what-is-x402.md) - Problem statement and solution overview
- [Use Cases](./01-overview/use-cases.md) - Real-world applications and scenarios
- [Architecture Overview](./01-overview/architecture-overview.md) - Three-component architecture

### [02 - Protocol Flows](./02-protocol-flows/)

**Flow diagrams** and sequence explanations showing how the protocol works.

- [Payment Flow Overview](./02-protocol-flows/payment-flow-overview.md) - High-level payment sequence
- [Happy Path](./02-protocol-flows/happy-path.md) - Successful payment flow step-by-step
- [Error Scenarios](./02-protocol-flows/error-scenarios.md) - Handling failures and edge cases
- [Network Variations](./02-protocol-flows/network-variations.md) - EVM vs SVM differences

### [03 - SDK Reference](./03-sdk-reference/)

**Complete SDK package documentation** for all x402 TypeScript libraries.

- [SDK Overview](./03-sdk-reference/README.md) - Package ecosystem and installation
- [Core Package](./03-sdk-reference/core/) - Protocol implementation (`@x402/core`)
- [HTTP Adapters](./03-sdk-reference/http-adapters/) - Client and server integrations
- [Payment Mechanisms](./03-sdk-reference/mechanisms/) - EVM and SVM implementations
- [Extensions](./03-sdk-reference/extensions/) - Bazaar and authentication

### [04 - Reference Implementation](./04-reference-implementation/)

**Code organization** and architecture of the TypeScript reference implementation.

- [Architecture](./04-reference-implementation/architecture.md) - Overall code structure
- [Client Architecture](./04-reference-implementation/client-architecture.md) - Fetch client design
- [Server Architecture](./04-reference-implementation/server-architecture.md) - Express server design
- [Facilitator Architecture](./04-reference-implementation/facilitator-architecture.md) - Facilitator setup
- [Test Harness](./04-reference-implementation/test-harness.md) - E2E test system

### [05 - Implementation Guide](./05-implementation-guide/)

**Technical details** including types, classes, and method-level documentation.

- [Types and Interfaces](./05-implementation-guide/types-and-interfaces.md) - Core type definitions
- [Client Implementation](./05-implementation-guide/client-implementation.md) - Method-by-method client flow
- [Server Implementation](./05-implementation-guide/server-implementation.md) - Method-by-method server flow
- [Facilitator Implementation](./05-implementation-guide/facilitator-implementation.md) - Verification & settlement
- [Payment Schemes](./05-implementation-guide/payment-schemes.md) - EIP-712 exact scheme details

### [06 - Detailed Flows](./06-detailed-flows/)

**Code execution paths** with actual object examples at each step.

- [Client Payment Flow](./06-detailed-flows/client-payment-flow.md) - Complete client execution with objects
- [Server Payment Flow](./06-detailed-flows/server-payment-flow.md) - Middleware execution with objects
- [Facilitator Flow](./06-detailed-flows/facilitator-flow.md) - Verify & settle with examples
- [Object Examples](./06-detailed-flows/object-examples.md) - Request/response sample data

### [07 - Tutorials](./07-tutorials/)

**Complete tutorials** for building real-world applications with x402.

- [Tutorial Overview](./07-tutorials/README.md) - Available tutorials and comparison
- [Basic Paywall](./07-tutorials/tutorial-basic-paywall.md) - Next.js paywall component (30-45 min)
- [API Monetization](./07-tutorials/tutorial-api-monetization.md) - Express API with tiered pricing (45-60 min)
- [Content Access](./07-tutorials/tutorial-content-access.md) - Blog/article monetization (45-60 min)

### [08 - Architecture](./08-architecture/)

**Architecture decision records** and protocol design documentation.

- [Architecture Overview](./08-architecture/README.md) - ADR index and overview
- [ADR-001: Header-Based Protocol](./08-architecture/adr-001-header-based.md) - Why headers vs body
- [ADR-002: Facilitator Pattern](./08-architecture/adr-002-facilitator.md) - Verification and settlement
- [ADR-003: Multi-Network Support](./08-architecture/adr-003-multi-network.md) - EVM and SVM support
- [ADR-004: Extensions](./08-architecture/adr-004-extensions.md) - Extension system design
- [Facilitator Protocol](./08-architecture/facilitator-protocol.md) - Facilitator HTTP protocol spec

### [09 - Appendix](./09-appendix/)

**Practical guides** and reference materials.

- [Environment Setup](./09-appendix/environment-setup.md) - Development environment configuration
- [Running Tests](./09-appendix/running-tests.md) - E2E test execution guide
- [Adding Implementations](./09-appendix/adding-implementations.md) - How to create new clients/servers
- [Production Deployment](./09-appendix/production.md) - Production best practices
- [Glossary](./09-appendix/glossary.md) - Terms and concepts

### [10 - Reference Implementations](./10-reference-implementations/)

**Language-specific facilitator** implementations beyond the primary TypeScript SDK.

- [Overview](./10-reference-implementations/README.md) - Available implementations
- [TypeScript Facilitator](./10-reference-implementations/typescript-facilitator.md) - Standalone TypeScript facilitator
- [Go Facilitator](./10-reference-implementations/go-facilitator.md) - Go implementation guide

---

## 🎯 Quick Navigation by Role

### I'm New to x402

1. Start: [What is x402?](./01-overview/what-is-x402.md)
2. Install: [Installation & Setup](./00-getting-started/installation.md)
3. Quick Start: Choose [Client](./00-getting-started/quick-start-client.md) or [Server](./00-getting-started/quick-start-server.md)
4. Tutorial: Pick a [Complete Tutorial](./07-tutorials/README.md)

### I'm Building a Client

1. Quick Start: [Client Quick Start](./00-getting-started/quick-start-client.md) ⚡ (10 minutes)
2. Flow: [Happy Path](./02-protocol-flows/happy-path.md)
3. SDK: [HTTP Adapters](./03-sdk-reference/http-adapters/)
4. Reference: [Client Architecture](./04-reference-implementation/client-architecture.md)
5. Details: [Client Implementation](./05-implementation-guide/client-implementation.md)
6. Examples: [Client Payment Flow](./06-detailed-flows/client-payment-flow.md)
7. Tutorial: [Basic Paywall](./07-tutorials/tutorial-basic-paywall.md) (30-45 min)

### I'm Building a Server

1. Quick Start: [Server Quick Start](./00-getting-started/quick-start-server.md) ⚡ (10 minutes)
2. Flow: [Happy Path](./02-protocol-flows/happy-path.md)
3. SDK: [HTTP Adapters](./03-sdk-reference/http-adapters/)
4. Reference: [Server Architecture](./04-reference-implementation/server-architecture.md)
5. Details: [Server Implementation](./05-implementation-guide/server-implementation.md)
6. Examples: [Server Payment Flow](./06-detailed-flows/server-payment-flow.md)
7. Tutorial: [API Monetization](./07-tutorials/tutorial-api-monetization.md) (45-60 min)

### I'm Building a Facilitator

1. Start: [Architecture Overview](./01-overview/architecture-overview.md)
2. Flow: [Payment Flow Overview](./02-protocol-flows/payment-flow-overview.md)
3. SDK: [Core Package](./03-sdk-reference/core/)
4. Reference: [Facilitator Architecture](./04-reference-implementation/facilitator-architecture.md)
5. Details: [Facilitator Implementation](./05-implementation-guide/facilitator-implementation.md)
6. Examples: [Facilitator Flow](./06-detailed-flows/facilitator-flow.md)
7. Implementations: [TypeScript](./10-reference-implementations/typescript-facilitator.md) | [Go](./10-reference-implementations/go-facilitator.md)

### I'm Integrating x402

1. Use Cases: [Use Cases](./01-overview/use-cases.md)
2. Overview: [Architecture Overview](./01-overview/architecture-overview.md)
3. SDK: [SDK Overview](./03-sdk-reference/README.md)
4. Setup: [Environment Setup](./09-appendix/environment-setup.md)
5. Examples: [Object Examples](./06-detailed-flows/object-examples.md)

---

## 📝 Documentation Philosophy

This documentation follows these principles:

1. **Code-Based**: All information is derived from the actual reference implementation in `/e2e`
2. **Progressive Depth**: Start simple, go deeper as you read
3. **Visual**: Heavy use of Mermaid diagrams for clarity
4. **Practical**: Real code snippets and object examples
5. **Complete**: From concepts to implementation details

---

## 🔗 Related Resources

- **Reference Code**: `/e2e/` directory (excluding `/e2e/legacy`)
- **Development Guide**: [CLAUDE.md](../CLAUDE.md)
- **Test Suite**: [E2E README](../e2e/README.md)
- **Package Source**: `typescript/packages/` directory

---

## 🤝 Contributing to Documentation

Found an error or want to improve the docs? Documentation should always reflect the actual implementation.

**Process**:
1. Verify against the code in `/e2e` and `typescript/packages/`
2. Update the relevant markdown file
3. Ensure diagrams render correctly on GitHub
4. Test any code examples
5. Submit a pull request

---

*This documentation is for x402 Protocol Version 2*
