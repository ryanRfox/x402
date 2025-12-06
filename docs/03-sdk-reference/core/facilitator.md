<!-- VERIFIED: 0aa62c64 -->
# Facilitator Module

The facilitator module provides server-side payment verification and settlement for the x402 protocol. A facilitator verifies signatures off-chain and broadcasts settlement transactions on-chain.

## Overview

The facilitator is responsible for:

- **Verification**: Validating payment signatures and authorization data
- **Settlement**: Broadcasting approved payment transactions to blockchain networks
- **Discovery**: Advertising supported payment schemes, networks, and extensions

Most applications use the hosted facilitator at `https://facilitator.x402.org` rather than running their own. Self-hosted facilitators are needed when you require custom settlement logic, full control over transaction broadcasting, or specific network configurations.

> [!NOTE]
> **Roadmap: Facilitator Enhancements**
> Planned facilitator improvements:
> - **Open-Source CDP Facilitator** - Production-grade reference implementation (Q4 2025)
> - **Facilitator Router** - Multi-network/scheme/token routing (Late Q2 2026)
>
> [View Roadmap](../../../09-appendix/roadmap.md#next-queued)

## x402Facilitator Class

### Constructor

```typescript
import { x402Facilitator } from "@x402/core/facilitator";

const facilitator = new x402Facilitator();
```

The facilitator instance manages registered payment schemes and provides verification, settlement, and discovery operations.

### Methods

#### verify

Verifies a payment payload against requirements.

```typescript
async verify(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse>
```

**Parameters:**
- `paymentPayload` - The payment payload containing signature and authorization
- `paymentRequirements` - The requirements to verify against

**Returns:**

```typescript
{
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}
```

**Example:**

```typescript
const result = await facilitator.verify(paymentPayload, paymentRequirements);

if (result.isValid) {
  console.log("Payment verified from:", result.payer);
} else {
  console.error("Verification failed:", result.invalidReason);
}
```

#### settle

Settles a verified payment by broadcasting the transaction on-chain.

```typescript
async settle(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<SettleResponse>
```

**Returns:**

```typescript
{
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: string;
}
```

**Example:**

```typescript
const result = await facilitator.settle(paymentPayload, paymentRequirements);

if (result.success) {
  console.log("Settlement transaction:", result.transaction);
  console.log("Network:", result.network);
} else {
  console.error("Settlement failed:", result.errorReason);
}
```

#### getSupported

Returns the payment schemes, networks, and extensions this facilitator supports.

```typescript
getSupported(): {
  kinds: Array<{
    x402Version: number;
    scheme: string;
    network: string;
  }>;
  extensions: string[];
  signers: Record<string, string[]>;
}
```

**Example:**

```typescript
const supported = facilitator.getSupported();

console.log("Supported schemes:", supported.kinds);
console.log("EVM signers:", supported.signers.eip155);
```

## Scheme Registration

The facilitator uses helper functions to register blockchain-specific payment schemes.

### EVM Registration

Register Ethereum and EVM-compatible chains using the Exact payment scheme with EIP-3009 TransferWithAuthorization.

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { privateKeyToAccount } from "viem/accounts";

const facilitator = new x402Facilitator();
const evmSigner = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: "eip155:84532", // Base Sepolia
});

// Multiple networks
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: ["eip155:84532", "eip155:8453"],
});
```

**Configuration:**
- `signer` - viem account for signing settlement transactions
- `networks` - Single network or array (CAIP-2 format: `eip155:<chainId>`)

### SVM Registration

Register Solana and SVM-compatible chains.

```typescript
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const svmSigner = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY!)
);

registerExactSvmScheme(facilitator, {
  signer: svmSigner,
  networks: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Devnet
});
```

**Configuration:**
- `signer` - Solana keypair for signing transactions
- `networks` - Single network or array (CAIP-2 format)

## Verify Operation

Verification checks that a payment payload is valid without broadcasting any transactions:

1. **Signature verification** - Validates cryptographic signatures
2. **Authorization validation** - Checks EIP-3009 authorization (EVM) or transaction signatures (SVM)
3. **Requirements matching** - Ensures payment meets the specified requirements
4. **Expiration checking** - Validates payment hasn't expired

**Common invalidReason values:**
- `invalid_signature` - Cryptographic signature verification failed
- `invalid_authorization` - Authorization data is malformed
- `amount_mismatch` - Payment amount doesn't match requirements
- `recipient_mismatch` - Payment recipient doesn't match requirements
- `expired` - Payment has expired

## Settle Operation

Settlement broadcasts the verified payment transaction to the blockchain:

1. Constructs the settlement transaction
2. Signs with the facilitator's private key
3. Broadcasts to the blockchain network
4. Waits for confirmation
5. Returns the transaction hash

**Important Notes:**
- The facilitator pays gas fees for settlement transactions
- Settlement requires native tokens (ETH, SOL) for gas
- Always verify before settling to avoid wasting gas on invalid payments

**Common errorReason values:**
- `insufficient_balance` - Payer doesn't have enough tokens
- `insufficient_gas` - Facilitator doesn't have enough gas
- `transaction_failed` - On-chain transaction reverted
- `network_error` - RPC or network connectivity issue

## getSupported Operation

The `getSupported()` method advertises the facilitator's capabilities:

```typescript
const supported = facilitator.getSupported();

// {
//   kinds: [
//     { x402Version: 2, scheme: "exact", network: "eip155:84532" },
//     { x402Version: 2, scheme: "exact", network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" }
//   ],
//   extensions: [],
//   signers: {
//     eip155: ["0x1234..."],
//     solana: ["AbC123..."]
//   }
// }
```

## Lifecycle Hooks

Lifecycle hooks allow you to inject custom logic before, after, or during failure of verify and settle operations.

### onBeforeVerify

Executes before verification starts. Can abort verification.

```typescript
facilitator.onBeforeVerify(async (context) => {
  console.log("Verifying payment...");

  // Optionally abort
  if (shouldReject(context.paymentPayload)) {
    return { abort: true, reason: "rejected_by_policy" };
  }
});
```

### onAfterVerify

Executes after successful verification.

```typescript
facilitator.onAfterVerify(async (context) => {
  console.log("Verified payment from:", context.result.payer);
});
```

### onBeforeSettle

Executes before settlement starts. Can abort settlement.

```typescript
facilitator.onBeforeSettle(async (context) => {
  console.log("Settling payment...");

  // Optionally abort
  return { abort: true, reason: "settlement_paused" };
});
```

### onAfterSettle

Executes after successful settlement.

```typescript
facilitator.onAfterSettle(async (context) => {
  console.log("Settlement tx:", context.result.transaction);
});
```

### onSettleFailure

Executes when settlement fails.

```typescript
facilitator.onSettleFailure(async (context) => {
  console.error("Settlement failed:", context.error);
});
```

### Hook Chaining

All hooks support method chaining:

```typescript
const facilitator = new x402Facilitator()
  .onBeforeVerify(async (ctx) => { /* ... */ })
  .onAfterVerify(async (ctx) => { /* ... */ })
  .onBeforeSettle(async (ctx) => { /* ... */ })
  .onAfterSettle(async (ctx) => { /* ... */ })
  .onSettleFailure(async (ctx) => { /* ... */ });
```

## Usage Examples

### Basic Facilitator Setup

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { privateKeyToAccount } from "viem/accounts";

const facilitator = new x402Facilitator();
const evmSigner = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: "eip155:84532",
});

const supported = facilitator.getSupported();
console.log("Facilitator supports:", supported.kinds);
```

### Multi-Chain Facilitator

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const facilitator = new x402Facilitator();

// EVM setup
const evmSigner = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: ["eip155:84532", "eip155:8453"],
});

// Solana setup
const svmSigner = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY!)
);
registerExactSvmScheme(facilitator, {
  signer: svmSigner,
  networks: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
});

console.log("Multi-chain facilitator ready");
```

### Express.js Facilitator Service

```typescript
import express from "express";
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { privateKeyToAccount } from "viem/accounts";

const app = express();
app.use(express.json());

const facilitator = new x402Facilitator();
const evmSigner = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: "eip155:84532",
});

// GET /supported
app.get("/supported", (req, res) => {
  res.json(facilitator.getSupported());
});

// POST /verify
app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      isValid: false,
      invalidReason: (error as Error).message,
    });
  }
});

// POST /settle
app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      errorReason: (error as Error).message,
    });
  }
});

app.listen(4022, () => {
  console.log("Facilitator running on port 4022");
});
```

### Facilitator with Lifecycle Hooks

```typescript
const facilitator = new x402Facilitator()
  .onBeforeVerify(async (context) => {
    console.log("Verifying payment for:", context.requirements.payTo);
  })
  .onAfterVerify(async (context) => {
    console.log("Payment verified from:", context.result.payer);
  })
  .onBeforeSettle(async (context) => {
    console.log("Settling payment...");
  })
  .onAfterSettle(async (context) => {
    console.log("Settlement tx:", context.result.transaction);
  })
  .onSettleFailure(async (context) => {
    console.error("Settlement failed:", context.error);
  });

registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: "eip155:84532",
});
```

## Network Format

All networks use the CAIP-2 standard format: `<namespace>:<reference>`

**EVM Networks:**
- `eip155:1` - Ethereum Mainnet
- `eip155:8453` - Base Mainnet
- `eip155:84532` - Base Sepolia

**Solana Networks:**
- `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` - Mainnet
- `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` - Devnet

## Requirements

### Private Keys

The facilitator needs private keys for:
- **Signature verification** - Validating payment signatures
- **Settlement transactions** - Broadcasting transactions on-chain (requires gas)

Store private keys securely using environment variables:

```bash
EVM_PRIVATE_KEY=0x...
SVM_PRIVATE_KEY=...
```

### Gas Tokens

The facilitator pays gas fees for settlement. Ensure sufficient native tokens:
- **EVM**: ETH on the target network
- **Solana**: SOL for transaction fees

## Security Considerations

- Never commit private keys to version control
- Use environment variables or secret management services
- Monitor facilitator wallet balances
- Always verify payments before settling
- Implement rate limiting on facilitator endpoints

## Next Steps

- [Facilitator Quick Start](../../00-getting-started/quick-start-facilitator.md) - Getting started guide
- [Server Module](./server.md) - Build resource servers
- [@x402/evm](../mechanisms/evm.md) - EVM payment mechanism
- [@x402/svm](../mechanisms/svm.md) - Solana payment mechanism
