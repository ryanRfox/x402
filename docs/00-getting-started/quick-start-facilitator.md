<!-- VERIFIED: 3c3e2168 -->
# Facilitator Quick Start

This guide shows how to run your own x402 facilitator service. A facilitator verifies payment signatures and settles payments on-chain.

## What is a Facilitator?

A facilitator is a service that:

1. **Verifies** payment signatures to ensure they are valid
2. **Settles** payments by submitting on-chain transactions
3. **Advertises** which payment schemes and networks it supports

**Most applications use the hosted facilitator at `https://facilitator.x402.org`.** You only need to run your own if you require:

- Custom payment settlement logic
- Private network support
- Enhanced privacy (no third-party involvement)
- Self-hosted infrastructure

> [!NOTE]
> **Roadmap: Open-Source CDP Facilitator**
> A production-grade reference facilitator implementation is planned for Q4 2025. This will include CDP's Server Wallet-based facilitator as a starting point for self-hosted deployments.
>
> [View Roadmap](../09-appendix/roadmap.md#next-queued)

## Prerequisites

Before running a facilitator, you need:

- Node.js 18 or higher
- Private keys for settlement accounts
- Native tokens for gas (ETH on Base, SOL on Solana)

## Installation

Install the required packages:

```bash
pnpm add @x402/core @x402/evm @x402/svm express viem @solana/web3.js dotenv
pnpm add -D @types/express tsx
```

## Implementation

Create a file `facilitator.ts`:

```typescript
import { config } from "dotenv";
import express from "express";
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { privateKeyToAccount } from "viem/accounts";

config();

// Initialize facilitator
const facilitator = new x402Facilitator();

// Register EVM support (Base Sepolia)
const evmSigner = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: "eip155:84532", // Base Sepolia
});

// Create Express server
const app = express();
app.use(express.json());

// GET /supported - Advertise supported schemes
app.get("/supported", async (req, res) => {
  const supported = await facilitator.getSupported();
  res.json(supported);
});

// POST /verify - Verify payment signature
app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      isValid: false,
      invalidReason: (error as Error).message
    });
  }
});

// POST /settle - Settle payment on-chain
app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      errorReason: (error as Error).message
    });
  }
});

const PORT = process.env.PORT || 4022;
app.listen(PORT, () => {
  console.log(`Facilitator running on http://localhost:${PORT}`);
  console.log(`EVM signer: ${evmSigner.address}`);
});
```

## Environment Variables

Create a `.env` file:

```bash
# EVM (Base Sepolia) - needs ETH for gas
EVM_PRIVATE_KEY=0x...

# Server port
PORT=4022
```

**Security Warning**: Never commit private keys to version control. Use environment variables or a secrets manager in production.

## API Endpoints

### GET /supported

Returns the payment schemes and networks supported by this facilitator.

**Response:**

```json
{
  "kinds": [
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:84532"
    }
  ],
  "extensions": [],
  "signers": {
    "eip155": ["0x..."]
  }
}
```

### POST /verify

Verifies a payment signature without submitting on-chain.

**Request:**

```json
{
  "paymentPayload": {
    "x402Version": 2,
    "resource": { "url": "..." },
    "accepted": { ... },
    "payload": { ... }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "10000",
    "payTo": "0x..."
  }
}
```

**Response (success):**

```json
{
  "isValid": true,
  "payer": "0x..."
}
```

**Response (failure):**

```json
{
  "isValid": false,
  "invalidReason": "invalid_signature"
}
```

### POST /settle

Settles a payment by submitting an on-chain transaction.

**Response (success):**

```json
{
  "success": true,
  "transaction": "0x...",
  "network": "eip155:84532",
  "payer": "0x..."
}
```

**Response (failure):**

```json
{
  "success": false,
  "errorReason": "insufficient_balance"
}
```

## Running the Facilitator

Start the server:

```bash
npx tsx facilitator.ts
```

The facilitator will be available at `http://localhost:4022`.

## Testing

Test the `/supported` endpoint:

```bash
curl http://localhost:4022/supported
```

## Using Your Facilitator

Point your resource server to your facilitator:

```typescript
const facilitatorClient = new HTTPFacilitatorClient({
  url: "http://localhost:4022"
});
```

## Adding Solana Support

To support Solana payments:

```typescript
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const svmSigner = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY!)
);

registerExactSvmScheme(facilitator, {
  signer: svmSigner,
  networks: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana Devnet
});
```

## Lifecycle Hooks

Add custom logic before/after operations:

```typescript
const facilitator = new x402Facilitator()
  .onBeforeVerify(async (context) => {
    console.log("Verifying payment...");
  })
  .onAfterVerify(async (context) => {
    console.log("Verification result:", context.result);
  })
  .onBeforeSettle(async (context) => {
    console.log("Settling payment...");
    // Return { abort: true, reason: "..." } to cancel
  })
  .onAfterSettle(async (context) => {
    console.log("Settlement tx:", context.result.transaction);
  })
  .onSettleFailure(async (context) => {
    console.error("Settlement failed:", context.error);
  });
```

## Production Considerations

When deploying to production:

1. **Gas Management**: Monitor settlement account balances
2. **Rate Limiting**: Implement rate limits to prevent abuse
3. **Authentication**: Add API keys for sensitive endpoints
4. **Monitoring**: Log all transactions and failures
5. **Security**: Use a secrets manager for private keys
6. **High Availability**: Run multiple instances behind a load balancer

## Next Steps

- [Server Quick Start](./quick-start-server.md) - Use your facilitator with a server
- [Facilitator README](https://github.com/coinbase/x402/tree/main/examples/typescript/facilitator) - Reference implementation
- [Architecture Overview](../01-overview/architecture-overview.md) - Understand the protocol
