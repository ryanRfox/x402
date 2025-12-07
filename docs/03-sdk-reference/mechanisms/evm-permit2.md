<!-- VERIFIED: 3c3e2168 -->
# @x402/evm - Permit2 Support

EVM implementation of the x402 payment protocol using Uniswap's Permit2 for arbitrary ERC-20 token support.

## Installation

```bash
pnpm add @x402/evm viem
```

The package requires `viem` as a peer dependency for account management and blockchain interactions.

## Overview

The `exact` scheme supports **any ERC-20 token** via Permit2 using the `assetTransferMethod` field. Instead of registering a separate scheme, you use `scheme: "exact"` with `extra.assetTransferMethod: "permit2"` in the payment requirements.

### Key Concept: assetTransferMethod

```typescript
const paymentRequirements = {
  scheme: "exact",                    // Same scheme as USDC
  network: "eip155:8453",
  asset: "0xYourToken",               // ANY ERC-20 token
  amount: "1000000",
  payTo: "0xRecipient",
  maxTimeoutSeconds: 300,
  extra: {
    assetTransferMethod: "permit2",   // Use Permit2 instead of EIP-3009
    facilitator: "0xFacilitator",     // Who will call permitTransferFrom
  },
};
```

### When to Use Permit2 vs EIP-3009

| Feature | Permit2 | EIP-3009 (default) |
|---------|---------|-------------------|
| Token Support | Any ERC-20 | Only EIP-3009 tokens |
| Setup Required | One-time approval to Permit2 | None |
| Gas Efficiency | Slightly higher | Optimized |
| extra Fields | `assetTransferMethod: "permit2"` | `name`, `version` (EIP-712) |
| Recommended For | Arbitrary tokens | USDC payments |

## Usage

### Client

The exact scheme automatically detects `assetTransferMethod: "permit2"` and creates the appropriate payload:

```typescript
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

// Create account from private key
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Create client and register exact scheme (handles both EIP-3009 and Permit2)
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });

// Wrap fetch with automatic payment handling
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Make paid requests
const response = await fetchWithPayment("http://server/protected");
```

### Server

Servers specify `assetTransferMethod: "permit2"` when configuring routes with arbitrary tokens:

```typescript
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org"
});

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server, {});

app.use(paymentMiddleware({
  "GET /protected": {
    accepts: {
      scheme: "exact",
      network: "eip155:8453",
      payTo: "0xYourAddress",
      price: {
        amount: "1000000000000000",  // 0.001 WETH (18 decimals)
        asset: "0x4200000000000000000000000000000000000006",  // WETH on Base
        extra: { assetTransferMethod: "permit2" },
      },
    },
    description: "Protected endpoint",
  },
}, server));
```

### Custom Money Parser

Register a money parser to automatically use Permit2 for specific tokens:

```typescript
import { ExactEvmScheme } from "@x402/evm/exact/server";

const evmScheme = new ExactEvmScheme();

// Register custom money parser for WETH via Permit2
evmScheme.registerMoneyParser(async (amount, network) => {
  if (network === "eip155:8453") {  // Base mainnet
    return {
      amount: BigInt(Math.round(amount * 1e18)).toString(),
      asset: "0x4200000000000000000000000000000000000006",  // WETH
      extra: { assetTransferMethod: "permit2" },
    };
  }
  return null;  // Use next parser
});

server.register("eip155:*", evmScheme);
```

### Facilitator

The facilitator automatically handles both EIP-3009 and Permit2 payloads:

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { privateKeyToAccount } from "viem/accounts";

const evmSigner = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

const facilitator = new x402Facilitator();
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: "eip155:84532",  // Base Sepolia
});
```

## Supported Networks

The Permit2 contract is deployed at the same address on all major EVM chains:

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

| Network | CAIP-2 ID | Permit2 Supported |
|---------|-----------|-------------------|
| Ethereum Mainnet | `eip155:1` | Yes |
| Base Mainnet | `eip155:8453` | Yes |
| Base Sepolia | `eip155:84532` | Yes |
| Optimism | `eip155:10` | Yes |
| Arbitrum | `eip155:42161` | Yes |
| Polygon | `eip155:137` | Yes |

## How Permit2 Works

### One-Time Approval

Before using Permit2, users must approve the Permit2 contract to spend their tokens:

```typescript
import { erc20Abi, maxUint256 } from "viem";

// Approve Permit2 for WETH (one-time per token)
await walletClient.writeContract({
  address: "0x4200000000000000000000000000000000000006",  // Token address
  abi: erc20Abi,
  functionName: "approve",
  args: [
    "0x000000000022D473030F116dDEE9F6B43aC78BA3",  // Permit2 address
    maxUint256,  // Max approval (recommended)
  ],
});
```

### Payment Flow

1. **Server Specifies Requirements**: Server includes `assetTransferMethod: "permit2"` in payment requirements
2. **Client Signs Message**: Client creates an EIP-712 signature for `PermitTransferFrom`
3. **Signature Sent to Server**: Signature and parameters sent as payment proof
4. **Facilitator Verifies**: Facilitator validates the signature off-chain
5. **On-Chain Execution**: Facilitator calls `permitTransferFrom` with signature
6. **Transfer Completes**: Tokens transferred from client to recipient on-chain

### SignatureTransfer Parameters

```typescript
interface PermitTransferFrom {
  permitted: {
    token: address;      // Token contract address
    amount: uint256;     // Maximum amount to transfer
  };
  spender: address;      // Facilitator address (who calls permitTransferFrom)
  nonce: uint256;        // Unique nonce (bitmap-based, non-sequential)
  deadline: uint256;     // Unix timestamp expiration
}
```

### Security Benefits

- **No Hanging Approvals**: Each signature authorizes exactly one transfer
- **Spender-Bound**: Only the designated spender (facilitator) can use the signature
- **Time-Limited**: Signatures expire after deadline
- **Nonce Protection**: Prevents replay attacks via bitmap-based nonces
- **Amount-Limited**: Signature caps maximum transfer amount

## Complete Example

```typescript
// CLIENT
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const response = await fetchWithPayment("http://server/protected");

// SERVER
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org"
});
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server, {});

app.use(paymentMiddleware({
  "GET /protected": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0xYourAddress",
      price: {
        amount: "1000000",  // Token amount
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: { assetTransferMethod: "permit2" },
      },
    },
    description: "Protected endpoint",
  },
}, server));

// FACILITATOR
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";

const evmSigner = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const facilitator = new x402Facilitator();
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: "eip155:84532",
});
```

## Multi-Token Example

Accept both USDC (via EIP-3009) and WETH (via Permit2) on the same endpoint:

```typescript
app.use(paymentMiddleware({
  "GET /multi-token": {
    accepts: [
      // USDC via EIP-3009 (default, gas-optimized)
      {
        scheme: "exact",
        network: "eip155:8453",
        payTo: "0xYourAddress",
        price: "$0.001",  // Uses USDC with EIP-3009 by default
      },
      // WETH via Permit2
      {
        scheme: "exact",
        network: "eip155:8453",
        payTo: "0xYourAddress",
        price: {
          amount: "1000000000000000",  // 0.001 WETH
          asset: "0x4200000000000000000000000000000000000006",
          extra: { assetTransferMethod: "permit2" },
        },
      },
    ],
    description: "Multi-token endpoint",
  },
}, server));
```

## Security Considerations

- **Private Key Management**: Never commit private keys. Use environment variables.
- **Token Approval**: Users must approve Permit2 before making payments.
- **Nonce Uniqueness**: The scheme automatically generates unique nonces.
- **Deadline Management**: Default validity prevents stale authorizations.
- **Facilitator Trust**: Signatures are bound to the facilitator's address.

## Troubleshooting

### "Insufficient Permit2 Allowance" Error

The user hasn't approved Permit2 for the token. They need to call `approve()` on the token contract first.

### "Invalid Permit2 Signature" Error

Common causes:
- Wrong chain ID in signature
- Wrong spender address (must be facilitator)
- Signature expired (past deadline)

### "Nonce Already Used" Error

Each Permit2 signature can only be used once. Generate a new payment for retry.

## Next Steps

- [EVM Exact Scheme](./evm.md) - EIP-3009 based payments (default)
- [Client Module](../core/client.md) - Core client documentation
- [Facilitator Module](../core/facilitator.md) - Facilitator documentation
