<!-- VERIFIED: 3c3e2168 -->
# @x402/svm

Solana Virtual Machine (SVM) implementation of the x402 payment protocol using SPL Token transfers.

## Installation

```bash
pnpm add @x402/svm @solana/kit @scure/base
```

The package has peer dependencies on Solana JavaScript libraries for transaction signing.

## Overview

This package provides Solana-compatible payment processing for the x402 protocol. It supports three components:

- **Client** - Applications that make payments (require wallet/keypair)
- **Server** - Resource servers that accept payments
- **Facilitator** - Payment processors that verify and submit transactions

## Subpath Exports

### Client

```typescript
import { registerExactSvmScheme } from "@x402/svm/exact/client";
```

### Server

```typescript
import { registerExactSvmScheme } from "@x402/svm/exact/server";
```

### Facilitator

```typescript
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";
```

## Client Usage

Clients sign transactions locally using their keypair.

```typescript
import { x402Client } from "@x402/core/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

// Create signer from private key
const keypair = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY!)
);

// Create client and register SVM scheme
const client = new x402Client();
registerExactSvmScheme(client, { signer: keypair });

// Wrap fetch with automatic payment handling
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Make paid requests
const response = await fetchWithPayment("http://server/protected");
```

### Configuration

```typescript
registerExactSvmScheme(client, {
  signer: keypair,  // Required: Solana keypair for signing
});
```

## Server Usage

Servers accept payments without needing private keys.

```typescript
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org"
});

const server = new x402ResourceServer(facilitatorClient);
registerExactSvmScheme(server);
```

No configuration needed for server-side registration.

## Facilitator Usage

Facilitators verify signatures and submit transactions to Solana.

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const svmSigner = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY!)
);

const facilitator = new x402Facilitator();
registerExactSvmScheme(facilitator, {
  signer: svmSigner,
  networks: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",  // Devnet
});
```

### Configuration

```typescript
registerExactSvmScheme(facilitator, {
  signer: svmSigner,  // Required: Solana keypair for settlement
  networks: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",  // Required: network(s)
});

// Multiple networks
registerExactSvmScheme(facilitator, {
  signer: svmSigner,
  networks: [
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",  // Devnet
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",  // Mainnet
  ],
});
```

## Supported Networks

The SVM package uses CAIP-2 network identifiers based on Solana genesis hash.

| Network | CAIP-2 ID |
|---------|-----------|
| Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Testnet | `solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z` |

### Wildcard Support

Clients and servers automatically support all Solana networks via `solana:*`:

```typescript
// Client automatically registers solana:* by default
registerExactSvmScheme(client, { signer: keypair });
```

> [!NOTE]
> **Roadmap: Payments MCP Solana Support**
> Multi-chain agentic finance support is planned for Solana via CDP SDK wallet integration.
> - **Target**: Q4 2025 / Q1 2026
>
> [View Roadmap](../../09-appendix/roadmap.md#next-queued)

## Default Asset: USDC

USDC is the default payment token:

| Network | USDC Address |
|---------|--------------|
| Mainnet | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Devnet | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

## Transaction Structure

The SVM implementation uses SPL Token `TransferChecked` instruction:

1. **Client Signs Transaction**: Client partially signs a transaction authorizing transfer
2. **Transaction Sent to Server**: Partially signed transaction sent as payment proof
3. **Facilitator Verifies**: Facilitator validates the signature
4. **Facilitator Co-Signs**: Facilitator adds signature as fee payer
5. **Transaction Submitted**: Fully signed transaction submitted to Solana
6. **Transfer Completes**: USDC transferred from client to recipient

## Complete Example

```typescript
// CLIENT
import { x402Client } from "@x402/core/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const keypair = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY!)
);
const client = new x402Client();
registerExactSvmScheme(client, { signer: keypair });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const response = await fetchWithPayment("http://server/protected");

// SERVER
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org"
});
const server = new x402ResourceServer(facilitatorClient);
registerExactSvmScheme(server);

app.use(paymentMiddleware({
  "GET /protected": {
    accepts: {
      scheme: "exact",
      network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      payTo: "YourSolanaAddress",
      price: "$0.001",
    },
    description: "Protected endpoint",
  },
}, server));

// FACILITATOR
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";

const svmSigner = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY!)
);
const facilitator = new x402Facilitator();
registerExactSvmScheme(facilitator, {
  signer: svmSigner,
  networks: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
});
```

## Multi-Chain Server Example

Accept both EVM and Solana payments:

```typescript
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);
registerExactSvmScheme(server);

app.use(paymentMiddleware({
  "GET /multi-chain": {
    accepts: [
      {
        scheme: "exact",
        network: "eip155:84532",
        payTo: "0xEvmAddress",
        price: "$0.001",
      },
      {
        scheme: "exact",
        network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        payTo: "SolanaAddress",
        price: "$0.001",
      },
    ],
    description: "Multi-chain endpoint",
  },
}, server));
```

## Security Considerations

- **Private Key Management**: Never commit private keys. Use environment variables.
- **Fee Payer**: Facilitator pays transaction fees (SOL required)
- **Transaction Validation**: Signatures verified before submission

## Next Steps

- [Client Module](../core/client.md) - Core client documentation
- [Facilitator Module](../core/facilitator.md) - Facilitator documentation
- [@x402/evm](./evm.md) - EVM payment mechanism
