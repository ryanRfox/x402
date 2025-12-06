<!-- VERIFIED: 3c3e2168 -->
# @x402/evm

EVM (Ethereum Virtual Machine) implementation of the x402 payment protocol using EIP-3009 TransferWithAuthorization.

## Installation

```bash
pnpm add @x402/evm viem
```

The package requires `viem` as a peer dependency for account management and blockchain interactions.

## Overview

This package provides EVM-compatible payment processing for the x402 protocol using EIP-3009's `transferWithAuthorization` for gasless token transfers. It supports three components:

- **Client** - Applications that make payments (require wallet/signer)
- **Server** - Resource servers that accept payments
- **Facilitator** - Payment processors that verify and execute on-chain transactions

## Subpath Exports

### Client

```typescript
import { registerExactEvmScheme } from "@x402/evm/exact/client";
```

### Server

```typescript
import { registerExactEvmScheme } from "@x402/evm/exact/server";
```

### Facilitator

```typescript
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
```

## Client Usage

Clients sign payment authorizations locally using their private key. The facilitator later executes the transfer on-chain.

```typescript
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

// Create account from private key
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Create client and register EVM scheme
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });

// Wrap fetch with automatic payment handling
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Make paid requests
const response = await fetchWithPayment("http://server/protected");
```

### Configuration

```typescript
registerExactEvmScheme(client, {
  signer: account,  // Required: viem account for signing
});
```

## Server Usage

Servers accept payments without needing private keys - they just build payment requirements.

```typescript
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org"
});

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);
```

No configuration needed for server-side registration.

## Facilitator Usage

Facilitators verify payment signatures and execute on-chain transfers.

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

### Configuration

```typescript
registerExactEvmScheme(facilitator, {
  signer: evmSigner,          // Required: viem account for settlement
  networks: "eip155:84532",   // Required: network(s) to support
});

// Multiple networks
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: ["eip155:84532", "eip155:8453"],  // Base Sepolia + Mainnet
});
```

## Supported Networks

The EVM package uses CAIP-2 network identifiers (`eip155:<chainId>`).

| Network | CAIP-2 ID | Description |
|---------|-----------|-------------|
| Ethereum Mainnet | `eip155:1` | Ethereum mainnet |
| Base Mainnet | `eip155:8453` | Base L2 mainnet |
| Base Sepolia | `eip155:84532` | Base testnet |

### Wildcard Support

Clients and servers automatically support all EVM chains via `eip155:*`:

```typescript
// Client automatically registers eip155:* by default
registerExactEvmScheme(client, { signer: account });
```

## EIP-3009: TransferWithAuthorization

The EVM implementation uses EIP-3009's `transferWithAuthorization` for gasless USDC transfers.

### How It Works

1. **Client Signs Authorization**: Client creates an EIP-712 signature authorizing a token transfer
2. **Authorization Sent to Server**: Signature and parameters sent as payment proof
3. **Facilitator Verifies**: Facilitator validates the signature off-chain
4. **On-Chain Execution**: Facilitator calls `transferWithAuthorization` with signature
5. **Transfer Completes**: Tokens transferred from client to recipient on-chain

### Authorization Parameters

```typescript
interface TransferWithAuthorization {
  from: address;        // Client's address
  to: address;          // Recipient address
  value: uint256;       // Amount in token units
  validAfter: uint256;  // Unix timestamp (payment valid after)
  validBefore: uint256; // Unix timestamp (payment expires)
  nonce: bytes32;       // Unique nonce (prevents replay)
}
```

### Benefits

- **Gasless for Clients**: Clients don't pay gas fees
- **Atomic Settlement**: Transfer and authorization in single transaction
- **Replay Protection**: Nonces prevent duplicate payments
- **Time-Bounded**: Validity windows prevent stale authorizations
- **EIP-712 Security**: Typed structured data signing

> [!NOTE]
> **Roadmap: Enhanced Token Support**
> Future enhancements planned for EVM payments:
> - **Arbitrary Token Support** - Permit/Permit2 flows for non-EIP-3009 tokens (Q2 2026)
> - **ERC-7710 On-Chain Delegations** - On-chain permission delegation (TBD)
>
> [View Roadmap](../../09-appendix/roadmap.md#later-future)

## Default Asset: USDC

USDC is the default payment token with built-in configurations:

| Network | USDC Contract |
|---------|---------------|
| Base Mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Ethereum Mainnet | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |

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
registerExactEvmScheme(server);

app.use(paymentMiddleware({
  "GET /protected": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0xYourAddress",
      price: "$0.001",
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

## Security Considerations

- **Private Key Management**: Never commit private keys. Use environment variables.
- **Nonce Uniqueness**: The scheme automatically generates unique nonces for each payment.
- **Validity Windows**: Default validity prevents stale authorizations.
- **Signature Verification**: EIP-712 signatures verified both off-chain and on-chain.

## Next Steps

- [Client Module](../core/client.md) - Core client documentation
- [Facilitator Module](../core/facilitator.md) - Facilitator documentation
- [@x402/svm](./svm.md) - Solana payment mechanism
