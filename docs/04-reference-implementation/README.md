<!-- VERIFIED: 3c3e2168 -->
# Reference Implementation

This section documents the x402 reference implementations. The repository contains two complementary sets of implementations:

| Source | Purpose | Characteristics |
|--------|---------|-----------------|
| `e2e/` | End-to-end testing | Tested in CI, minimal, canonical patterns |
| `examples/typescript/` | Advanced patterns | Feature-rich, production patterns |

> [!NOTE]
> **Legacy Exclusion**: All paths containing `/legacy/` are V1 implementations and should be ignored. Only use non-legacy code for V2 documentation.

## Contents

- [Architecture](./architecture.md) - Overall E2E architecture and component interaction
- [Client Architecture](./client-architecture.md) - Reference client implementation
- [Server Architecture](./server-architecture.md) - Reference server implementation
- [Facilitator Architecture](./facilitator-architecture.md) - Reference facilitator implementation

## E2E Reference Implementations

These are tested in CI and represent the canonical "how to wire up x402" patterns.

### Source Code

```
e2e/
├── clients/
│   ├── fetch/              # Fetch client (V2)
│   └── axios/              # Axios client (V2)
├── servers/
│   ├── express/            # Express server (V2)
│   ├── hono/               # Hono server (V2)
│   └── next/               # Next.js with paymentProxy and withX402
├── facilitators/
│   └── typescript/         # TypeScript facilitator
└── extensions/
    └── bazaar.ts           # Bazaar discovery extension
```

### Running E2E Tests

```bash
cd e2e
pnpm install
pnpm test          # Interactive mode - select components to test
pnpm test --min    # Minimized mode - 90% fewer tests, full coverage
```

See [e2e/README.md](https://github.com/coinbase/x402/tree/main/e2e) for full test documentation.

## Advanced Examples

Located in `examples/typescript/`, these show production-ready patterns beyond basic setup.

### Server Advanced Patterns

| File | Pattern | Use Case |
|------|---------|----------|
| `servers/advanced/hooks.ts` | Lifecycle hooks | Logging, validation, error recovery |
| `servers/advanced/dynamic-price.ts` | Dynamic pricing | Tiered pricing, context-based pricing |
| `servers/advanced/dynamic-pay-to.ts` | Dynamic payTo | Marketplace routing, multi-vendor |
| `servers/advanced/custom-money-definition.ts` | Custom tokens | Non-USDC tokens, DAI, custom assets |
| `servers/advanced/bazaar.ts` | Bazaar discovery | API discoverability |

### Client Advanced Patterns

| File | Pattern | Use Case |
|------|---------|----------|
| `clients/advanced/hooks.ts` | Payment hooks | Logging, monitoring, error recovery |
| `clients/advanced/preferred-network.ts` | Network selection | Multi-chain preference |

### Fullstack Examples

| Directory | Description |
|-----------|-------------|
| `fullstack/next/` | Complete Next.js application with x402 middleware |

See [examples/typescript/README.md](https://github.com/coinbase/x402/tree/main/examples/typescript) for setup instructions.

## Quick Reference

### Client Pattern

```typescript
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client();
registerExactEvmScheme(client, { signer: privateKeyToAccount(privateKey) });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const response = await fetchWithPayment("http://server/protected");
```

### Server Pattern

```typescript
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: facilitatorUrl }));
registerExactEvmScheme(server);

app.use(paymentMiddleware({
  "GET /protected": {
    accepts: { scheme: "exact", network: "eip155:84532", payTo: address, price: "$0.001" },
    description: "Protected endpoint",
  },
}, server));
```

### Facilitator Pattern

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { privateKeyToAccount } from "viem/accounts";

const facilitator = new x402Facilitator();
registerExactEvmScheme(facilitator, {
  signer: privateKeyToAccount(privateKey),
  networks: "eip155:84532",
});
```
