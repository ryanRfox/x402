<!-- VERIFIED: 0aa62c64 -->
# Facilitator Implementation

This guide explains how to build custom facilitators for payment verification and settlement.

## Overview

The `x402Facilitator` class handles cryptographic verification of payment signatures and executes on-chain settlement transactions. Facilitators are the bridge between HTTP payments and blockchain execution.

```mermaid
flowchart LR
    Server[Resource Server] --> Facilitator[x402Facilitator]
    Facilitator --> Scheme[SchemeNetworkFacilitator]
    Scheme --> Chain[Blockchain RPC]
```

## Key Interfaces

### SchemeNetworkFacilitator

Every payment scheme must implement this interface for facilitator operations:

```typescript
interface SchemeNetworkFacilitator {
  readonly scheme: string;
  readonly caipFamily: string;

  getExtra(network: Network): Record<string, unknown> | undefined;
  getSigners(network: string): string[];

  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
}
```

### VerifyResponse

```typescript
type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
};
```

### SettleResponse

```typescript
type SettleResponse = {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: Network;
};
```

### SupportedResponse

```typescript
type SupportedResponse = {
  kinds: SupportedKind[];
  extensions: string[];
  signers: Record<string, string[]>;
};

type SupportedKind = {
  x402Version: number;
  scheme: string;
  network: Network;
  extra?: Record<string, unknown>;
};
```

## Implementation Steps

### 1. Create Facilitator Instance

```typescript
import { x402Facilitator } from "@x402/core/facilitator";

const facilitator = new x402Facilitator();
```

### 2. Register Payment Schemes

```typescript
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

// EVM signer (needs ETH for gas)
const evmSigner = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: "eip155:84532",
});

// Solana signer (needs SOL for fees)
const svmSigner = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY!)
);
registerExactSvmScheme(facilitator, {
  signer: svmSigner,
  networks: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
});
```

### 3. Register Extensions

```typescript
facilitator.registerExtension("bazaar");
```

### 4. Expose HTTP Endpoints

```typescript
import express from "express";

const app = express();
app.use(express.json());

// Discovery endpoint
app.get("/supported", (req, res) => {
  res.json(facilitator.getSupported());
});

// Verification endpoint
app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(400).json({ isValid: false, invalidReason: error.message });
  }
});

// Settlement endpoint
app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, errorReason: error.message });
  }
});

app.listen(4022);
```

## Lifecycle Hooks

### Verify Hooks

```typescript
facilitator.onBeforeVerify(async (context) => {
  console.log("Verifying:", context.paymentPayload);

  // Rate limiting
  if (isRateLimited(context.requirements.network)) {
    return { abort: true, reason: "Rate limited" };
  }
});

facilitator.onAfterVerify(async (context) => {
  // Only called for successful verification (isValid: true)
  console.log("Verified payer:", context.result.payer);
  await logVerification(context);
});

facilitator.onVerifyFailure(async (context) => {
  // Called for isValid: false or exceptions
  console.error("Verification failed:", context.error);

  // Attempt recovery
  if (canRecover(context)) {
    return { recovered: true, result: { isValid: true, payer: "0x..." } };
  }
});
```

### Settle Hooks

```typescript
facilitator.onBeforeSettle(async (context) => {
  console.log("Settling payment...");

  // Check for duplicate settlement
  if (await isDuplicate(context.paymentPayload)) {
    return { abort: true, reason: "Duplicate settlement" };
  }
});

facilitator.onAfterSettle(async (context) => {
  console.log("Settled:", context.result.transaction);
  await recordTransaction(context.result);
});

facilitator.onSettleFailure(async (context) => {
  console.error("Settlement failed:", context.error);
  await alertOps(context.error);

  // Attempt recovery with retry
  if (isRetryable(context.error)) {
    const retryResult = await retrySettlement(context);
    if (retryResult) {
      return { recovered: true, result: retryResult };
    }
  }
});
```

## Multi-Network Support

Register schemes for multiple networks:

```typescript
// Multiple EVM networks
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: ["eip155:84532", "eip155:8453", "eip155:1"],
});

// Multiple Solana networks
registerExactSvmScheme(facilitator, {
  signer: svmSigner,
  networks: [
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Devnet
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d", // Mainnet
  ],
});
```

## Custom Scheme Implementation

To implement a custom payment scheme for a facilitator:

```typescript
import { SchemeNetworkFacilitator } from "@x402/core";

class CustomSchemeFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = "custom";
  readonly caipFamily = "custom:*";

  constructor(private signer: CustomSigner) {}

  getExtra(network: Network): Record<string, unknown> | undefined {
    return { customField: "value" };
  }

  getSigners(network: string): string[] {
    return [this.signer.address];
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    try {
      // 1. Extract signature from payload
      const { signature, from, nonce } = payload.payload as CustomPayloadData;

      // 2. Reconstruct message that was signed
      const message = buildMessage({
        amount: requirements.amount,
        asset: requirements.asset,
        payTo: requirements.payTo,
        nonce,
      });

      // 3. Verify signature
      const recoveredAddress = recoverSigner(message, signature);

      if (recoveredAddress.toLowerCase() !== from.toLowerCase()) {
        return { isValid: false, invalidReason: "Invalid signature" };
      }

      // 4. Additional validations
      if (!isNonceValid(nonce)) {
        return { isValid: false, invalidReason: "Invalid nonce" };
      }

      return { isValid: true, payer: from };
    } catch (error) {
      return { isValid: false, invalidReason: error.message };
    }
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const { signature, from, nonce } = payload.payload as CustomPayloadData;

    // 1. Build settlement transaction
    const tx = buildSettlementTx({
      from,
      to: requirements.payTo,
      amount: requirements.amount,
      asset: requirements.asset,
      signature,
      nonce,
    });

    // 2. Sign and submit transaction
    const signedTx = await this.signer.signTransaction(tx);
    const txHash = await submitTransaction(signedTx);

    // 3. Wait for confirmation
    await waitForConfirmation(txHash);

    return {
      success: true,
      transaction: txHash,
      network: requirements.network,
      payer: from,
    };
  }
}

// Register custom scheme
facilitator.register("custom:network", new CustomSchemeFacilitator(signer));
```

## Gas/Fee Management

The facilitator pays transaction fees. Monitor and manage gas:

```typescript
// Check balance before settling
facilitator.onBeforeSettle(async (context) => {
  const balance = await getSignerBalance(context.requirements.network);

  if (balance < minimumBalance) {
    await alertLowBalance(context.requirements.network, balance);
    return { abort: true, reason: "Insufficient gas balance" };
  }
});

// Log gas usage after settlement
facilitator.onAfterSettle(async (context) => {
  const gasUsed = await getTransactionGas(context.result.transaction);
  await logGasUsage(context.requirements.network, gasUsed);
});
```

## Security Considerations

1. **Private Key Storage** - Use environment variables or secret management
2. **Rate Limiting** - Prevent abuse with request limits
3. **Input Validation** - Validate all incoming requests
4. **Nonce Tracking** - Prevent replay attacks
5. **Logging** - Log all transactions for audit

```typescript
// Rate limiting hook
const requestCounts = new Map<string, number>();

facilitator.onBeforeVerify(async (context) => {
  const ip = getClientIP();
  const count = (requestCounts.get(ip) || 0) + 1;
  requestCounts.set(ip, count);

  if (count > MAX_REQUESTS_PER_MINUTE) {
    return { abort: true, reason: "Rate limit exceeded" };
  }
});

// Audit logging hook
facilitator.onAfterSettle(async (context) => {
  await auditLog({
    event: "settlement",
    transaction: context.result.transaction,
    network: context.result.network,
    payer: context.result.payer,
    amount: context.requirements.amount,
    timestamp: new Date().toISOString(),
  });
});
```

## API Reference

### GET /supported

Returns supported payment kinds and signer addresses.

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
  "extensions": ["bazaar"],
  "signers": {
    "eip155:*": ["0x..."]
  }
}
```

### POST /verify

Verifies a payment signature.

**Request:**

```json
{
  "paymentPayload": { "...": "..." },
  "paymentRequirements": { "...": "..." }
}
```

**Response (success):**

```json
{
  "isValid": true,
  "payer": "0x..."
}
```

### POST /settle

Settles a payment on-chain.

**Request:**

```json
{
  "paymentPayload": { "...": "..." },
  "paymentRequirements": { "...": "..." }
}
```

**Response (success):**

```json
{
  "success": true,
  "transaction": "0x...",
  "network": "eip155:84532",
  "payer": "0x..."
}
```

## Next Steps

- [Payment Schemes](./payment-schemes.md) - Understanding scheme architecture
- [Types and Interfaces](./types-and-interfaces.md) - Complete type reference
- [Production](../09-appendix/production.md) - Production deployment guide
