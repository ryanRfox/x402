# x402 Tutorials

Complete, step-by-step tutorials for building real-world applications with x402 payment protocol. Each tutorial includes full source code, explanations, and deployment guidance.

## Available Tutorials

### 1. Basic Paywall Tutorial
**[Next.js Paywall Implementation](./tutorial-basic-paywall.md)**

Build a complete paywall component for your Next.js application that allows users to pay for premium content access.

**What you'll learn:**
- Integrating x402 with Next.js 14 (App Router)
- Creating reusable paywall UI components
- Managing payment state with React hooks
- Handling payment success and failure flows
- Styling with Tailwind CSS

**Time:** 30-45 minutes
**Level:** Beginner to Intermediate
**Framework:** Next.js 14, React, TypeScript

---

### 2. API Monetization Tutorial
**[Express API with Tiered Pricing](./tutorial-api-monetization.md)**

Build a RESTful API with multiple pricing tiers, usage tracking, and rate limiting based on payment levels.

**What you'll learn:**
- Setting up tiered pricing for API endpoints
- Tracking API usage per user
- Implementing rate limiting with payment requirements
- Building an admin dashboard for monitoring
- Managing API keys and access control

**Time:** 45-60 minutes
**Level:** Intermediate
**Framework:** Express, TypeScript, PostgreSQL

---

### 3. Content Access Tutorial
**[Blog/Article Monetization](./tutorial-content-access.md)**

Create a content monetization system for blogs, articles, or digital content with per-article payments and bulk access options.

**What you'll learn:**
- Protecting individual articles with payments
- Building a content preview system
- Implementing "pay per article" vs "subscription"
- Tracking purchased content per user
- Creating a content library interface

**Time:** 45-60 minutes
**Level:** Intermediate
**Framework:** Next.js, React, TypeScript

---

## Prerequisites

Before starting these tutorials, you should:

1. **Complete the Quick Start Guides**
   - [Client Quick Start](../00-getting-started/quick-start-client.md)
   - [Server Quick Start](../00-getting-started/quick-start-server.md)

2. **Have Your Environment Set Up**
   - Node.js >= 18.0.0
   - pnpm or npm installed
   - Wallet with testnet funds
   - See [Installation Guide](../00-getting-started/installation.md)

3. **Understand Basic Concepts**
   - [What is x402?](../01-overview/what-is-x402.md)
   - [Protocol Flows](../02-protocol-flows/happy-path.md)

---

## Tutorial Structure

Each tutorial follows a consistent structure:

1. **Overview** - What you'll build and why
2. **Setup** - Project initialization and dependencies
3. **Implementation** - Step-by-step code walkthrough
4. **Testing** - How to test your implementation
5. **Deployment** - Production deployment guidance
6. **Enhancements** - Ideas for extending the tutorial

---

## Getting Help

If you encounter issues:

1. **Check the troubleshooting section** in each tutorial
2. **Review the SDK Reference**: [SDK Documentation](../03-sdk-reference/README.md)
3. **Explore reference implementations**: [Reference Code](../04-reference-implementation/README.md)
4. **Open an issue**: [GitHub Issues](https://github.com/coinbase/x402/issues)

---

## Tutorial Comparison

| Tutorial | Framework | Complexity | Time | Topics |
|----------|-----------|------------|------|--------|
| [Basic Paywall](./tutorial-basic-paywall.md) | Next.js | Beginner | 30-45 min | UI components, payment flows |
| [API Monetization](./tutorial-api-monetization.md) | Express | Intermediate | 45-60 min | Tiered pricing, rate limiting |
| [Content Access](./tutorial-content-access.md) | Next.js | Intermediate | 45-60 min | Per-item pricing, user tracking |

---

## Next Steps After Tutorials

Once you've completed these tutorials, explore:

1. **Advanced Implementation Patterns**
   - [Implementation Guide](../05-implementation-guide/README.md)
   - [Detailed Protocol Flows](../06-detailed-flows/README.md)

2. **Production Deployment**
   - [Production Guide](../09-appendix/production.md)
   - [Security Best Practices](../09-appendix/security.md)

3. **SDK Deep Dive**
   - [Core Package](../03-sdk-reference/core/README.md)
   - [HTTP Adapters](../03-sdk-reference/http-adapters/README.md)
   - [Payment Mechanisms](../03-sdk-reference/mechanisms/README.md)

4. **Contributing**
   - Build your own integrations
   - Share your implementations
   - Contribute to the x402 ecosystem

---

## Community Examples

Looking for more examples? Check out:

- **Example repositories**: [x402 Examples](https://github.com/coinbase/x402-examples)
- **Community showcase**: [x402 Community](https://github.com/coinbase/x402/discussions)
- **Integration guides**: [Third-party Integrations](../09-appendix/integrations.md)

---

## Feedback

We'd love to hear about your experience with these tutorials!

- **Found a bug?** [Report it](https://github.com/coinbase/x402/issues/new?template=bug_report.md)
- **Have a suggestion?** [Share it](https://github.com/coinbase/x402/issues/new?template=feature_request.md)
- **Built something cool?** [Show us](https://github.com/coinbase/x402/discussions/categories/show-and-tell)
