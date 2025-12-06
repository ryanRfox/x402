<!-- VERIFIED: 0aa62c64 -->
# x402 Documentation

x402 is a protocol and SDK for building HTTP APIs that accept cryptocurrency micropayments per request. Add a few lines of code to charge for API access without subscriptions, accounts, or payment processors.

## Quick Example

**Server** (Express):
```typescript
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const app = express();
const server = new x402ResourceServer(
  new HTTPFacilitatorClient({ url: "https://facilitator.x402.org" })
);
registerExactEvmScheme(server);

app.use(paymentMiddleware({
  "GET /api/premium": {
    accepts: {
      scheme: "exact",
      network: "eip155:8453",        // Base Mainnet
      payTo: "0xYourAddress",
      price: "$0.001",               // $0.001 per request
    },
  },
}, server));

app.get("/api/premium", (req, res) => res.json({ data: "paid content" }));
```

**Client** (Fetch):
```typescript
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client();
registerExactEvmScheme(client, {
  signer: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
});

const paidFetch = wrapFetchWithPayment(fetch, client);

// Automatic payment handling - just use like normal fetch
const response = await paidFetch("https://api.example.com/api/premium");
```

## Choose Your Path

| I want to... | Start here |
|--------------|------------|
| Protect my API with payments | [Server Quick Start](./00-getting-started/quick-start-server.md) |
| Pay for APIs programmatically | [Client Quick Start](./00-getting-started/quick-start-client.md) |
| Run my own facilitator | [Facilitator Quick Start](./00-getting-started/quick-start-facilitator.md) |
| Understand how x402 works | [What is x402?](./01-overview/what-is-x402.md) |
| See the full payment flow | [Payment Flow Overview](./02-protocol-flows/payment-flow-overview.md) |

## Packages

### Core
| Package | Description |
|---------|-------------|
| `@x402/core` | Core types, client, server, and facilitator classes |

### HTTP Adapters
| Package | Description |
|---------|-------------|
| `@x402/express` | Express.js middleware for payment-protected routes |
| `@x402/hono` | Hono middleware for edge/serverless deployments |
| `@x402/next` | Next.js App Router integration |
| `@x402/fetch` | Fetch wrapper with automatic payment handling |
| `@x402/axios` | Axios interceptor for automatic payments |

### Payment Mechanisms
| Package | Description |
|---------|-------------|
| `@x402/evm` | EVM chains (Ethereum, Base, Polygon) via EIP-3009 |
| `@x402/svm` | Solana via SPL Token transfers |

### Extensions
| Package | Description |
|---------|-------------|
| `@x402/extensions` | Protocol extensions (Bazaar service discovery) |

## Supported Networks

| Network | Identifier | Asset |
|---------|------------|-------|
| Base Mainnet | `eip155:8453` | USDC |
| Base Sepolia | `eip155:84532` | USDC |
| Ethereum Mainnet | `eip155:1` | USDC |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | USDC |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | USDC |

## Documentation Sections

### Getting Started
- [Installation](./00-getting-started/installation.md) - Install packages
- [Server Quick Start](./00-getting-started/quick-start-server.md) - Protect your first endpoint
- [Client Quick Start](./00-getting-started/quick-start-client.md) - Make your first paid request
- [Facilitator Quick Start](./00-getting-started/quick-start-facilitator.md) - Run your own facilitator

### Concepts
- [What is x402?](./01-overview/what-is-x402.md) - Protocol overview
- [Architecture](./01-overview/architecture-overview.md) - System components
- [Use Cases](./01-overview/use-cases.md) - Real-world applications

### Protocol Flows
- [Payment Flow Overview](./02-protocol-flows/payment-flow-overview.md) - How payments work
- [Happy Path](./02-protocol-flows/happy-path.md) - Successful payment sequence
- [Error Scenarios](./02-protocol-flows/error-scenarios.md) - Handling failures
- [Network Variations](./02-protocol-flows/network-variations.md) - EVM vs Solana differences

### SDK Reference
- [Core Package](./03-sdk-reference/core/README.md) - Client, Server, Facilitator, Types
- [HTTP Adapters](./03-sdk-reference/http-adapters/README.md) - Express, Hono, Next.js, Fetch, Axios
- [Payment Mechanisms](./03-sdk-reference/mechanisms/README.md) - EVM, Solana
- [Extensions](./03-sdk-reference/extensions/README.md) - Bazaar discovery

### Advanced
- [Reference Implementation](./04-reference-implementation/README.md) - E2E example code
- [Implementation Guide](./05-implementation-guide/README.md) - Custom schemes, deep dives
- [Production Deployment](./09-appendix/production.md) - Security, scaling, monitoring

### Reference
- [Glossary](./09-appendix/glossary.md) - Terms and definitions
- [Environment Setup](./09-appendix/environment-setup.md) - Configuration guide
- [Running Tests](./09-appendix/running-tests.md) - E2E test execution

## Links

- [GitHub Repository](https://github.com/coinbase/x402)
- [Hosted Facilitator](https://facilitator.x402.org)
