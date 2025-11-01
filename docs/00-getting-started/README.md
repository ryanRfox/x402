# Getting Started with x402

This section provides quick-start guides to help you integrate x402 payment protocol into your applications. Whether you're building a client that consumes paid APIs or a server that monetizes your endpoints, these guides will get you up and running in under 10 minutes.

## Table of Contents

- [Installation & Setup](./installation.md) - Environment configuration and dependencies
- [Client Quick Start](./quick-start-client.md) - Make your first paid API request
- [Server Quick Start](./quick-start-server.md) - Protect your endpoints with payments

## What You'll Learn

### Client Quick Start
- Install and configure the x402 SDK
- Set up a wallet for payments
- Make authenticated requests to paid endpoints
- Handle payment responses and errors

### Server Quick Start
- Install payment middleware
- Configure payment requirements for endpoints
- Set up a facilitator for payment verification
- Test the complete payment flow

## Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18.0.0 (we recommend using [mise](https://mise.jdx.dev/) for version management)
- **pnpm** 10.7.0 (recommended) or npm/yarn
- **A wallet** with private key for signing transactions
- **Testnet funds** for development (Base Sepolia USDC for EVM)

## Quick Links

- **Need to understand the protocol first?** Start with [What is x402?](../01-overview/what-is-x402.md)
- **Want complete API documentation?** See [SDK Reference](../03-sdk-reference/README.md)
- **Ready for production?** Check the [Production Deployment Guide](../09-appendix/production.md)
- **Looking for tutorials?** Browse [Tutorials](../07-tutorials/README.md) for complete examples

## Getting Help

If you encounter issues:
1. Check the [Troubleshooting](./quick-start-client.md#troubleshooting) sections in the quick start guides
2. Review the [SDK Reference](../03-sdk-reference/README.md) for detailed API documentation
3. Explore [Reference Implementations](../04-reference-implementation/README.md) for working examples
4. Open an issue on [GitHub](https://github.com/coinbase/x402)

## Next Steps

1. **Start here**: [Installation & Setup](./installation.md)
2. **Choose your path**:
   - Building a client? → [Client Quick Start](./quick-start-client.md)
   - Building a server? → [Server Quick Start](./quick-start-server.md)
3. **Go deeper**: Explore [Tutorials](../07-tutorials/README.md) for complete applications
