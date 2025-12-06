<!-- VERIFIED: 3c3e2168 -->
# Types and Interfaces

Complete type reference for the x402 SDK.

## Core Types

### Network

CAIP-2 format network identifier.

```typescript
type Network = `${string}:${string}`;

// Examples
const baseSepolia: Network = "eip155:84532";
const solanaDevnet: Network = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
```

### Money

User-friendly price representation.

```typescript
type Money = string | number;

// Examples
const dollars: Money = "$0.001";
const cents: Money = 0.001;
const raw: Money = "1000";
```

### AssetAmount

On-chain asset amount representation.

```typescript
type AssetAmount = {
  asset: string;      // Contract address or asset identifier
  amount: string;     // Amount in smallest unit (e.g., wei, lamports)
  extra?: Record<string, unknown>;
};

// Example
const usdcAmount: AssetAmount = {
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  amount: "1000000", // 1 USDC (6 decimals)
};
```

### Price

Union type for price specification.

```typescript
type Price = Money | AssetAmount;
```

## Payment Types

### PaymentRequirements

Requirements for a payment to be accepted.

```typescript
type PaymentRequirements = {
  scheme: string;                    // Payment scheme (e.g., "exact")
  network: Network;                  // CAIP-2 network identifier
  asset: string;                     // Asset contract/identifier
  amount: string;                    // Amount in smallest unit
  payTo: string;                     // Recipient address
  maxTimeoutSeconds: number;         // Maximum time for settlement
  extra: Record<string, unknown>;    // Scheme-specific data
};
```

### PaymentPayload

Client-signed payment authorization.

```typescript
type PaymentPayload = {
  x402Version: number;               // Protocol version (1 or 2)
  resource: ResourceInfo;            // Resource being accessed
  accepted: PaymentRequirements;     // Accepted payment requirements
  payload: Record<string, unknown>;  // Scheme-specific signed data
  extensions?: Record<string, unknown>;
};
```

### PaymentRequired

Server response for 402 Payment Required.

```typescript
type PaymentRequired = {
  x402Version: number;               // Protocol version
  error?: string;                    // Error message
  resource: ResourceInfo;            // Resource information
  accepts: PaymentRequirements[];    // Accepted payment methods
  extensions?: Record<string, unknown>;
};
```

### ResourceInfo

Information about a protected resource.

```typescript
interface ResourceInfo {
  url: string;          // Resource URL
  description: string;  // Human-readable description
  mimeType: string;     // Expected response MIME type
}
```

## Facilitator Types

### VerifyRequest

Request to verify a payment signature.

```typescript
type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};
```

### VerifyResponse

Result of payment verification.

```typescript
type VerifyResponse = {
  isValid: boolean;        // Whether signature is valid
  invalidReason?: string;  // Reason if invalid
  payer?: string;          // Payer address if valid
};
```

### SettleRequest

Request to settle a payment on-chain.

```typescript
type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};
```

### SettleResponse

Result of payment settlement.

```typescript
type SettleResponse = {
  success: boolean;       // Whether settlement succeeded
  errorReason?: string;   // Reason if failed
  payer?: string;         // Payer address
  transaction: string;    // Transaction hash
  network: Network;       // Network where settled
};
```

### SupportedKind

A supported payment kind from a facilitator.

```typescript
type SupportedKind = {
  x402Version: number;               // Protocol version
  scheme: string;                    // Payment scheme
  network: Network;                  // Network identifier
  extra?: Record<string, unknown>;   // Scheme-specific metadata
};
```

### SupportedResponse

Facilitator's supported payment methods.

```typescript
type SupportedResponse = {
  kinds: SupportedKind[];                // Supported payment kinds
  extensions: string[];                  // Supported extensions
  signers: Record<string, string[]>;     // CAIP family -> addresses
};
```

## Mechanism Types

### SchemeNetworkClient

Client-side scheme implementation.

```typescript
interface SchemeNetworkClient {
  readonly scheme: string;

  createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "x402Version" | "payload">>;
}
```

### SchemeNetworkServer

Server-side scheme implementation.

```typescript
interface SchemeNetworkServer {
  readonly scheme: string;

  parsePrice(price: Price, network: Network): Promise<AssetAmount>;

  enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: SupportedKind,
    facilitatorExtensions: string[],
  ): Promise<PaymentRequirements>;
}
```

### SchemeNetworkFacilitator

Facilitator scheme implementation.

```typescript
interface SchemeNetworkFacilitator {
  readonly scheme: string;
  readonly caipFamily: string;

  getExtra(network: Network): Record<string, unknown> | undefined;
  getSigners(network: string): string[];

  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse>;

  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse>;
}
```

### MoneyParser

Function to convert amounts to asset amounts.

```typescript
type MoneyParser = (
  amount: number,
  network: Network,
) => Promise<AssetAmount | null>;
```

## Client Types

### PaymentPolicy

Policy function for filtering payment requirements.

```typescript
type PaymentPolicy = (
  x402Version: number,
  paymentRequirements: PaymentRequirements[],
) => PaymentRequirements[];
```

### SelectPaymentRequirements

Function to select from available payment options.

```typescript
type SelectPaymentRequirements = (
  x402Version: number,
  paymentRequirements: PaymentRequirements[],
) => PaymentRequirements;
```

### x402ClientConfig

Configuration for creating a client.

```typescript
interface x402ClientConfig {
  schemes: SchemeRegistration[];
  policies?: PaymentPolicy[];
  paymentRequirementsSelector?: SelectPaymentRequirements;
}

interface SchemeRegistration {
  network: Network;
  client: SchemeNetworkClient;
  x402Version?: number;  // Default: 2
}
```

## Hook Types

### Client Hooks

```typescript
// Before payment creation
type BeforePaymentCreationHook = (
  context: PaymentCreationContext,
) => Promise<void | { abort: true; reason: string }>;

// After payment creation
type AfterPaymentCreationHook = (
  context: PaymentCreatedContext,
) => Promise<void>;

// On payment creation failure
type OnPaymentCreationFailureHook = (
  context: PaymentCreationFailureContext,
) => Promise<void | { recovered: true; payload: PaymentPayload }>;

// Context types
interface PaymentCreationContext {
  paymentRequired: PaymentRequired;
  selectedRequirements: PaymentRequirements;
}

interface PaymentCreatedContext extends PaymentCreationContext {
  paymentPayload: PaymentPayload;
}

interface PaymentCreationFailureContext extends PaymentCreationContext {
  error: Error;
}
```

### Server Hooks

```typescript
// Verify hooks
type BeforeVerifyHook = (
  context: VerifyContext,
) => Promise<void | { abort: true; reason: string }>;

type AfterVerifyHook = (
  context: VerifyResultContext,
) => Promise<void>;

type OnVerifyFailureHook = (
  context: VerifyFailureContext,
) => Promise<void | { recovered: true; result: VerifyResponse }>;

// Settle hooks
type BeforeSettleHook = (
  context: SettleContext,
) => Promise<void | { abort: true; reason: string }>;

type AfterSettleHook = (
  context: SettleResultContext,
) => Promise<void>;

type OnSettleFailureHook = (
  context: SettleFailureContext,
) => Promise<void | { recovered: true; result: SettleResponse }>;

// Context types
interface VerifyContext {
  paymentPayload: PaymentPayload;
  requirements: PaymentRequirements;
}

interface VerifyResultContext extends VerifyContext {
  result: VerifyResponse;
}

interface VerifyFailureContext extends VerifyContext {
  error: Error;
}

interface SettleContext {
  paymentPayload: PaymentPayload;
  requirements: PaymentRequirements;
}

interface SettleResultContext extends SettleContext {
  result: SettleResponse;
}

interface SettleFailureContext extends SettleContext {
  error: Error;
}
```

### Facilitator Hooks

```typescript
// Same patterns as server hooks
type FacilitatorBeforeVerifyHook = (
  context: FacilitatorVerifyContext,
) => Promise<void | { abort: true; reason: string }>;

type FacilitatorAfterVerifyHook = (
  context: FacilitatorVerifyResultContext,
) => Promise<void>;

type FacilitatorOnVerifyFailureHook = (
  context: FacilitatorVerifyFailureContext,
) => Promise<void | { recovered: true; result: VerifyResponse }>;

type FacilitatorBeforeSettleHook = (
  context: FacilitatorSettleContext,
) => Promise<void | { abort: true; reason: string }>;

type FacilitatorAfterSettleHook = (
  context: FacilitatorSettleResultContext,
) => Promise<void>;

type FacilitatorOnSettleFailureHook = (
  context: FacilitatorSettleFailureContext,
) => Promise<void | { recovered: true; result: SettleResponse }>;
```

## Server Configuration Types

### ResourceConfig

Configuration for a protected resource.

```typescript
interface ResourceConfig {
  scheme: string;
  payTo: string;
  price: Price;
  network: Network;
  maxTimeoutSeconds?: number;
}
```

### FacilitatorClient

Interface for facilitator communication.

```typescript
interface FacilitatorClient {
  getSupported(): Promise<SupportedResponse>;
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
}
```

## Extension Types

### ResourceServerExtension

Extension for resource servers.

```typescript
interface ResourceServerExtension {
  key: string;
  enrichDeclaration?(
    declaration: unknown,
    transportContext: unknown,
  ): unknown;
}
```

## HTTP Header Constants

```typescript
// Request header containing signed payment
const PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE";

// Response header with payment requirements (402)
const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";

// Response header with settlement confirmation (200)
const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";
```

## Version Constant

```typescript
// Current x402 protocol version
const x402Version = 2;
```

## Type Guards

```typescript
// Check if response is v1 or v2
function isV2PaymentRequired(response: unknown): response is PaymentRequired {
  return (response as PaymentRequired).x402Version === 2;
}

// Check if payload is v1 or v2
function isV2PaymentPayload(payload: unknown): payload is PaymentPayload {
  return (payload as PaymentPayload).x402Version === 2;
}
```

## Next Steps

- [Client Implementation](./client-implementation.md) - Using types in clients
- [Server Implementation](./server-implementation.md) - Using types in servers
- [Payment Schemes](./payment-schemes.md) - Implementing scheme interfaces
