<!-- VERIFIED: 0aa62c64 -->
# Types

The core types module defines all TypeScript interfaces and type aliases used throughout the x402 protocol. These types ensure type safety across clients, servers, and facilitators, and are essential for understanding how payments flow through the system.

## Quick Reference

All types are exported from `@x402/core`:

```typescript
import type {
  // Core types
  Network,
  Money,
  AssetAmount,
  Price,
  ResourceInfo,

  // Payment flow types
  PaymentRequirements,
  PaymentRequired,
  PaymentPayload,

  // Facilitator types
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
  SupportedResponse,

  // Mechanism implementation
  SchemeNetworkClient,
  SchemeNetworkServer,
  SchemeNetworkFacilitator,
  MoneyParser,
} from "@x402/core";
```

## Core Types

Core types represent fundamental concepts in the x402 protocol.

### Network

A blockchain network identifier in CAIP-2 format.

```typescript
type Network = `${string}:${string}`;
```

The format is `chainNamespace:chainReference`:

```typescript
// EVM networks
const baseMainnet: Network = "eip155:8453";
const baseSepolia: Network = "eip155:84532";
const ethereumMainnet: Network = "eip155:1";

// Solana networks
const solanaMainnet: Network = "solana:5eykt4UsFv2P6aBCvDYq67p6RBVS5zjhUiogHTy7o9d";
const solanaDevnet: Network = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
```

The CAIP-2 format is standardized by the [Chain Agnostic Improvement Proposals](https://chainagnostic.org/) and is widely used in blockchain ecosystems.

### Money

A numeric representation of a monetary amount.

```typescript
type Money = string | number;
```

Can be a simple number (e.g., `"0.10"` for $0.10) or a complex amount structure. Numbers are preferred for precision in blockchain applications.

```typescript
// Valid Money values
const exactPrice: Money = "0.10";
const decimalPrice: Money = 0.10;
```

### AssetAmount

Represents a specific asset with an amount.

```typescript
type AssetAmount = {
  asset: string;
  amount: string;
  extra?: Record<string, unknown>;
};
```

**Fields:**
- `asset` - Asset identifier (contract address for EVM, mint address for Solana, etc.)
- `amount` - Amount in the asset's native decimals (always a string for precision)
- `extra` - Optional metadata for mechanism-specific data

**Example:**

```typescript
const usdc: AssetAmount = {
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  amount: "100000", // 0.10 USDC (6 decimals)
};

const usdc_solana: AssetAmount = {
  asset: "EPjFWaLb3odccxmLVGGDU7DMXoK2csxwapEP4GqoCZo", // USDC on Solana
  amount: "100000", // 0.10 USDC (6 decimals)
};
```

### Price

A union of simple and complex pricing models.

```typescript
type Price = Money | AssetAmount;
```

Allows servers to specify prices in flexible ways:

```typescript
const simplePrice: Price = "0.10";
const complexPrice: Price = {
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  amount: "100000",
};
```

### ResourceInfo

Metadata about the protected resource being accessed.

```typescript
interface ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
}
```

**Fields:**
- `url` - The URL of the resource
- `description` - Human-readable description
- `mimeType` - MIME type (e.g., "application/json", "text/html")

**Example:**

```typescript
const apiEndpoint: ResourceInfo = {
  url: "https://api.example.com/v1/data",
  description: "Premium API endpoint with real-time data",
  mimeType: "application/json",
};
```

## Payment Flow Types

These types represent the payment flow between clients, servers, and facilitators.

### PaymentRequirements

Specifies what payment is required to access a resource.

```typescript
type PaymentRequirements = {
  scheme: string;
  network: Network;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
};
```

**Fields:**
- `scheme` - Payment scheme identifier (e.g., "exact-evm", "exact-svm")
- `network` - Target blockchain network
- `asset` - Asset identifier (contract address, mint address, etc.)
- `amount` - Amount required in native decimals
- `payTo` - Payment recipient address
- `maxTimeoutSeconds` - Maximum time allowed to create payment
- `extra` - Scheme-specific metadata

**Example:**

```typescript
const requirements: PaymentRequirements = {
  scheme: "exact-evm",
  network: "eip155:8453",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  amount: "100000", // 0.10 USDC
  payTo: "0x1234...5678",
  maxTimeoutSeconds: 300,
  extra: {
    chainId: 8453,
  },
};
```

### PaymentRequired

The response sent by a server when a client tries to access a protected resource without payment.

```typescript
type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
};
```

**Fields:**
- `x402Version` - Version of the x402 protocol (e.g., `1`)
- `error` - Optional error message
- `resource` - Information about the resource being protected
- `accepts` - Array of payment schemes the server accepts
- `extensions` - Optional extension metadata

**Example:**

```typescript
const paymentRequired: PaymentRequired = {
  x402Version: 1,
  resource: {
    url: "https://api.example.com/v1/data",
    description: "Premium data API",
    mimeType: "application/json",
  },
  accepts: [
    {
      scheme: "exact-evm",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      amount: "100000",
      payTo: "0x1234...5678",
      maxTimeoutSeconds: 300,
      extra: {},
    },
  ],
};
```

### PaymentPayload

The signed payment data sent by a client to access a protected resource.

```typescript
type PaymentPayload = {
  x402Version: number;
  resource: ResourceInfo;
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
};
```

**Fields:**
- `x402Version` - Version of the x402 protocol
- `resource` - The resource being accessed
- `accepted` - The specific payment requirement that was accepted and signed
- `payload` - Scheme-specific signed payment data (e.g., transaction details, signatures)
- `extensions` - Optional extension metadata

**Example:**

```typescript
const paymentPayload: PaymentPayload = {
  x402Version: 1,
  resource: {
    url: "https://api.example.com/v1/data",
    description: "Premium data API",
    mimeType: "application/json",
  },
  accepted: {
    scheme: "exact-evm",
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount: "100000",
    payTo: "0x1234...5678",
    maxTimeoutSeconds: 300,
    extra: {},
  },
  payload: {
    // Scheme-specific data
    to: "0x1234...5678",
    from: "0xabcd...efgh",
    value: "0",
    data: "0x...", // Encoded transaction data
    chainId: 8453,
    nonce: 42,
    v: 28,
    r: "0x...",
    s: "0x...",
  },
};
```

## Facilitator Types

These types handle communication between servers and facilitators for payment verification and settlement.

### VerifyRequest

A request from a server to a facilitator to verify a payment.

```typescript
type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};
```

### VerifyResponse

The facilitator's response after verifying a payment.

```typescript
type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
};
```

**Fields:**
- `isValid` - Whether the payment signature and requirements are valid
- `invalidReason` - Why verification failed (if `isValid` is false)
- `payer` - The address that made the payment

**Example:**

```typescript
const verifyResponse: VerifyResponse = {
  isValid: true,
  payer: "0xabcd...efgh",
};

const verifyFailure: VerifyResponse = {
  isValid: false,
  invalidReason: "Signature verification failed",
};
```

### SettleRequest

A request from a server to a facilitator to settle a payment on-chain.

```typescript
type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};
```

### SettleResponse

The facilitator's response after settling a payment on-chain.

```typescript
type SettleResponse = {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: Network;
};
```

**Fields:**
- `success` - Whether the settlement transaction was successful
- `errorReason` - Why settlement failed (if `success` is false)
- `payer` - The address that paid
- `transaction` - Transaction hash on the blockchain
- `network` - The blockchain network where settlement occurred

**Example:**

```typescript
const settleSuccess: SettleResponse = {
  success: true,
  payer: "0xabcd...efgh",
  transaction: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  network: "eip155:8453",
};

const settleFailure: SettleResponse = {
  success: false,
  errorReason: "Insufficient gas",
  network: "eip155:8453",
  transaction: "",
};
```

### SupportedKind

Represents a single payment scheme/network combination that a facilitator supports.

```typescript
type SupportedKind = {
  x402Version: number;
  scheme: string;
  network: Network;
  extra?: Record<string, unknown>;
};
```

**Fields:**
- `x402Version` - x402 protocol version
- `scheme` - Payment scheme identifier
- `network` - Blockchain network
- `extra` - Mechanism-specific metadata

### SupportedResponse

The facilitator's response to a `/supported` request listing all payment schemes and networks it handles.

```typescript
type SupportedResponse = {
  kinds: SupportedKind[];
  extensions: string[];
  signers: Record<string, string[]>; // CAIP family pattern → Signer addresses
};
```

**Fields:**
- `kinds` - Array of supported scheme/network combinations
- `extensions` - List of supported extension identifiers
- `signers` - Mapping of CAIP family patterns (e.g., "eip155:*") to signer addresses

**Example:**

```typescript
const supportedResponse: SupportedResponse = {
  kinds: [
    {
      x402Version: 1,
      scheme: "exact-evm",
      network: "eip155:8453",
    },
    {
      x402Version: 1,
      scheme: "exact-svm",
      network: "solana:5eykt4UsFv2P6aBCvDYq67p6RBVS5zjhUiogHTy7o9d",
    },
  ],
  extensions: [],
  signers: {
    "eip155:*": ["0x1234...5678"],
    "solana:*": ["11111111111111111111111111111111"],
  },
};
```

## Implementation Interfaces

These interfaces define how different blockchain mechanisms implement x402 functionality.

### MoneyParser

A function that converts a simple numeric amount to an AssetAmount.

```typescript
type MoneyParser = (amount: number, network: Network) => Promise<AssetAmount | null>;
```

**Parameters:**
- `amount` - The decimal amount (e.g., 0.10)
- `network` - The target network for context

**Returns:** An `AssetAmount` or `null` to try the next parser

**Example:**

```typescript
const usdcParser: MoneyParser = async (amount, network) => {
  // Only handle Base network
  if (network !== "eip155:8453") {
    return null;
  }

  // Convert to USDC (6 decimals)
  return {
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount: Math.floor(amount * 1e6).toString(),
  };
};
```

### SchemeNetworkClient

Interface for a payment scheme's client-side implementation.

```typescript
interface SchemeNetworkClient {
  readonly scheme: string;

  createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "x402Version" | "payload">>;
}
```

**Methods:**

#### createPaymentPayload

Creates a signed payment payload for the given requirements.

**Parameters:**
- `x402Version` - The x402 protocol version
- `paymentRequirements` - Requirements specified by the server

**Returns:** A partial `PaymentPayload` containing the version and signed payload

**Example:**

```typescript
const paymentPayload = await evmScheme.createPaymentPayload(1, requirements);
// Returns: { x402Version: 1, payload: { /* signed tx data */ } }
```

### SchemeNetworkServer

Interface for a payment scheme's server-side implementation.

```typescript
interface SchemeNetworkServer {
  readonly scheme: string;

  parsePrice(price: Price, network: Network): Promise<AssetAmount>;

  enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      x402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    facilitatorExtensions: string[],
  ): Promise<PaymentRequirements>;
}
```

**Methods:**

#### parsePrice

Converts a user-friendly price to a scheme-specific asset and amount.

**Parameters:**
- `price` - Price in any format (simple string or AssetAmount)
- `network` - Target blockchain network

**Returns:** An `AssetAmount` with the scheme's specific asset identifier and amount

**Example:**

```typescript
// Convert simple price to EVM USDC
const assetAmount = await evmScheme.parsePrice("0.10", "eip155:8453");
// Returns: { asset: "0x833589...", amount: "100000", extra: {} }
```

#### enhancePaymentRequirements

Adds scheme-specific metadata to payment requirements.

**Parameters:**
- `paymentRequirements` - Base requirements with amount and asset already set
- `supportedKind` - The supported kind from the facilitator
- `facilitatorExtensions` - Extensions supported by the facilitator

**Returns:** Enhanced `PaymentRequirements` ready to send to clients

### SchemeNetworkFacilitator

Interface for a payment scheme's facilitator-side implementation.

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

**Properties:**

#### caipFamily

The CAIP family pattern this facilitator handles (e.g., "eip155:*" for EVM, "solana:*" for Solana).

**Example:**

```typescript
class EvmFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = "exact-evm";
  readonly caipFamily = "eip155:*";
}

class SvmFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = "exact-svm";
  readonly caipFamily = "solana:*";
}
```

**Methods:**

#### getExtra

Returns mechanism-specific extra data for the supported response.

**Parameters:**
- `network` - The target network

**Returns:** Extra data object or `undefined`

**Example:**

```typescript
// EVM typically needs no extra data
getExtra(network: Network): undefined {
  return undefined;
}

// SVM might need fee payer info
getExtra(network: Network): Record<string, unknown> | undefined {
  return { feePayer: this.signer.address };
}
```

#### getSigners

Returns the signer addresses for a network.

**Parameters:**
- `network` - The target network

**Returns:** Array of signer addresses (wallet addresses, fee payers, etc.)

**Example:**

```typescript
getSigners(network: Network): string[] {
  return [...this.signer.getAddresses()];
}
```

#### verify

Verifies that a payment payload matches the requirements.

**Parameters:**
- `payload` - The payment payload from the client
- `requirements` - The original payment requirements

**Returns:** A `VerifyResponse` indicating whether verification succeeded

#### settle

Settles a verified payment on-chain.

**Parameters:**
- `payload` - The payment payload
- `requirements` - The original payment requirements

**Returns:** A `SettleResponse` with transaction details

## Usage Examples

### Typical Client Usage

```typescript
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import type { PaymentPayload, PaymentRequirements } from "@x402/core";

const client = new x402Client();
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
registerExactEvmScheme(client, { signer: account });

// When you receive a PaymentRequired response
const requirements: PaymentRequirements = /* from server */;
const payload: PaymentPayload = await client.createPaymentPayload(requirements, resourceInfo);

// Send payload back to server
```

### Typical Server Usage

```typescript
import { x402ResourceServer } from "@x402/core/server";
import type { Price, PaymentPayload, PaymentRequirements } from "@x402/core";

const server = new x402ResourceServer(facilitatorClient);

// Specify price for a resource
const price: Price = "0.10";

// Server creates requirements
const requirements = await server.buildPaymentRequirements(price, "eip155:8453");

// When client returns a payment, verify it
const payload: PaymentPayload = /* from client */;
const verifyResult = await server.verifyPayment(payload, requirements);

if (verifyResult.isValid) {
  // Settle the payment on-chain
  const settleResult = await server.settlePayment(payload, requirements);
}
```

## See Also

- [Client Module](/docs/03-sdk-reference/core/client.md) - Using x402 as a payment consumer
- [Server Module](/docs/03-sdk-reference/core/server.md) - Building payment-protected resources
- [Facilitator Module](/docs/03-sdk-reference/core/facilitator.md) - Running a payment facilitator
- [EVM Mechanisms](/docs/03-sdk-reference/mechanisms/evm.md) - Ethereum-based payments
- [SVM Mechanisms](/docs/03-sdk-reference/mechanisms/svm.md) - Solana-based payments
