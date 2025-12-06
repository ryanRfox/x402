<!-- VERIFIED: 3c3e2168 -->
# Installation

## Prerequisites

x402 requires:
- **Node.js 18+** (LTS recommended)
- A package manager: **pnpm** (recommended), npm, or yarn

Verify your Node.js version:

```bash
node --version
```

## Package Overview

x402 is published as scoped packages under `@x402`:

| Package | Purpose |
|---------|---------|
| `@x402/core` | Core protocol implementation (typically installed as a dependency) |
| `@x402/fetch` | Fetch-based client for making paid requests |
| `@x402/axios` | Axios-based client for making paid requests |
| `@x402/express` | Express.js middleware for paid endpoints |
| `@x402/hono` | Hono middleware for paid endpoints |
| `@x402/next` | Next.js integration for paid endpoints |
| `@x402/evm` | EVM payment mechanism (Ethereum, Base, etc.) |
| `@x402/svm` | Solana payment mechanism |

## Client Installation

Install a client package to make requests to paid endpoints.

### Using Fetch Client

```bash
pnpm add @x402/fetch @x402/evm viem
# or
npm install @x402/fetch @x402/evm viem
# or
yarn add @x402/fetch @x402/evm viem
```

### Using Axios Client

```bash
pnpm add @x402/axios @x402/evm viem
# or
npm install @x402/axios @x402/evm viem
# or
yarn add @x402/axios @x402/evm viem
```

## Server Installation

Install a server package to protect your API endpoints with payment requirements.

### Express.js

```bash
pnpm add @x402/express @x402/evm
# or
npm install @x402/express @x402/evm
# or
yarn add @x402/express @x402/evm
```

### Hono

```bash
pnpm add @x402/hono @x402/evm
# or
npm install @x402/hono @x402/evm
# or
yarn add @x402/hono @x402/evm
```

### Next.js

```bash
pnpm add @x402/next @x402/evm
# or
npm install @x402/next @x402/evm
# or
yarn add @x402/next @x402/evm
```

## Payment Mechanism Installation

Install payment mechanisms to handle blockchain transactions.

### EVM (Ethereum, Base, etc.)

```bash
pnpm add @x402/evm viem
# or
npm install @x402/evm viem
# or
yarn add @x402/evm viem
```

**Peer dependency**: `viem` (v2.x) is required for EVM blockchain interactions.

### Solana (SVM)

```bash
pnpm add @x402/svm @solana/web3.js
# or
npm install @x402/svm @solana/web3.js
# or
yarn add @x402/svm @solana/web3.js
```

**Peer dependency**: `@solana/web3.js` is required for Solana blockchain interactions.

## Complete Setup Examples

### Client with EVM Payment

```bash
pnpm add @x402/fetch @x402/evm viem
```

### Client with Solana Payment

```bash
pnpm add @x402/fetch @x402/svm @solana/web3.js
```

### Express Server with EVM Payment

```bash
pnpm add @x402/express @x402/evm
```

### Multi-Chain Server (EVM + Solana)

```bash
pnpm add @x402/express @x402/evm @x402/svm viem @solana/web3.js
```

## Verification

After installation, verify packages are available:

```bash
pnpm list @x402/core
```

## Next Steps

- [Client Quick Start](./quick-start-client.md) - Build a payment-enabled client
- [Server Quick Start](./quick-start-server.md) - Create a server with paid endpoints
- [SDK Reference](../03-sdk-reference/README.md) - Detailed API documentation
