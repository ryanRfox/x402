# Types and Interfaces

Complete reference for all core types and interfaces in the x402 v2 protocol.

## Core Type Definitions

Location: `typescript/packages/core/src/types/`

### Network

```typescript
type Network = `${string}:${string}`;
```

**Format**: `<protocol>:<identifier>`

**Examples**:
- `"eip155:8453"` - Base Mainnet
- `"eip155:84532"` - Base Sepolia
- `"solana:mainnet"` - Solana Mainnet

### Money and Price

```typescript
type Money = string | number;

type AssetAmount = {
  asset: string;          // Token contract address
  amount: string;         // Amount in smallest units
  extra?: Record<string, any>;
};

type Price = Money | AssetAmount;
```

**Usage**:
```typescript
// Simple prices
price: "$0.001"
price: 0.001
price: "0.001 USDC"

// Explicit asset amount
price: {
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  amount: "1000",
  extra: { name: "USD Coin", version: "2" }
}
```

## Payment Types

### PaymentRequirements

**File**: `typescript/packages/core/src/types/payments.ts`

```typescript
type PaymentRequirements = {
  scheme: string;                    // "exact", "streaming", etc.
  network: Network;                  // "eip155:8453"
  asset: string;                     // Token contract address
  amount: string;                    // Amount in smallest units
  payTo: string;                     // Recipient address
  maxTimeoutSeconds: number;         // Payment validity duration
  extra: Record<string, any>;        // Scheme-specific data
}
```

**Example**:
```json
{
  "scheme": "exact",
  "network": "eip155:84532",
  "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "amount": "1000",
  "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "maxTimeoutSeconds": 300,
  "extra": {
    "name": "USDC",
    "version": "2"
  }
}
```

### PaymentRequired

**File**: `typescript/packages/core/src/types/payments.ts`

```typescript
type PaymentRequired = {
  x402Version: number;               // Protocol version (2)
  error?: string;                    // Optional error message
  resource: {
    url: string;                     // Resource URL
    description: string;             // Human-readable description
    mimeType: string;                // Expected response type
  };
  accepts: PaymentRequirements[];    // Array of acceptable payments
  extensions?: Record<string, any>;  // Protocol extensions
}
```

**Example**:
```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://localhost:4021/protected",
    "description": "Protected endpoint",
    "mimeType": "application/json"
  },
  "accepts": [
    { /* PaymentRequirements */ }
  ]
}
```

### PaymentPayload

**File**: `typescript/packages/core/src/types/payments.ts`

```typescript
type PaymentPayload = {
  x402Version: number;               // Protocol version (2)
  scheme: string;                    // Payment scheme used
  network: Network;                  // Network used
  payload: Record<string, any>;      // Scheme-specific payment data
  accepted: PaymentRequirements;     // Requirements being satisfied
  extensions?: Record<string, any>;  // Protocol extensions
}
```

**Example (EVM Exact)**:
```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "eip155:84532",
  "payload": {
    "authorization": {
      "from": "0xABC...",
      "to": "0x742d...",
      "value": "1000",
      "validAfter": "1730000000",
      "validBefore": "1730000300",
      "nonce": "0x1234..."
    },
    "signature": "0xabcd..."
  },
  "accepted": { /* PaymentRequirements */ }
}
```

## Facilitator Types

### VerifyRequest & VerifyResponse

**File**: `typescript/packages/core/src/types/facilitator.ts`

```typescript
type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}
```

**Example Response**:
```json
{
  "isValid": true,
  "payer": "0xABC123..."
}
```

### SettleRequest & SettleResponse

**File**: `typescript/packages/core/src/types/facilitator.ts`

```typescript
type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

type SettleResponse = {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: Network;
}
```

**Example Response**:
```json
{
  "success": true,
  "transaction": "0xdef456789abc...",
  "network": "eip155:84532",
  "payer": "0xABC123..."
}
```

### SupportedResponse

**File**: `typescript/packages/core/src/types/facilitator.ts`

```typescript
type SupportedResponse = {
  kinds: {
    x402Version: number;
    scheme: string;
    network: Network;
    extra?: Record<string, any>;
  }[];
  extensions: string[];
}
```

**Example Response**:
```json
{
  "kinds": [
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:84532",
      "extra": {}
    }
  ],
  "extensions": []
}
```

## Mechanism Interfaces

### SchemeNetworkClient

**File**: `typescript/packages/core/src/types/mechanisms.ts`

```typescript
interface SchemeNetworkClient {
  readonly scheme: string;

  createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements
  ): Promise<PaymentPayload>;
}
```

**Implementation**: `ExactEvmClient` in `typescript/packages/mechanisms/evm/src/exact/index.ts`

### SchemeNetworkFacilitator

**File**: `typescript/packages/core/src/types/mechanisms.ts`

```typescript
interface SchemeNetworkFacilitator {
  readonly scheme: string;

  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse>;

  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse>;
}
```

**Implementation**: `ExactEvmFacilitator` in `typescript/packages/mechanisms/evm/src/exact/index.ts`

### SchemeNetworkService

**File**: `typescript/packages/core/src/types/mechanisms.ts`

```typescript
interface SchemeNetworkService {
  readonly scheme: string;

  parsePrice(price: Price, network: Network): AssetAmount;

  enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      x402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, any>;
    },
    facilitatorExtensions: string[]
  ): Promise<PaymentRequirements>;
}
```

**Implementation**: `ExactEvmService` in `typescript/packages/mechanisms/evm/src/exact/index.ts`

## HTTP Types

### HTTPAdapter

**File**: `typescript/packages/core/src/http/x402HTTPResourceService.ts`

```typescript
interface HTTPAdapter {
  getHeader(name: string): string | undefined;
  getMethod(): string;
  getPath(): string;
  getUrl(): string;
  getAcceptHeader(): string;
  getUserAgent(): string;
}
```

**Implementation**: `ExpressAdapter` in `typescript/packages/http/express/src/index.ts`

### RouteConfig

**File**: `typescript/packages/core/src/http/x402HTTPResourceService.ts`

```typescript
interface RouteConfig {
  scheme: string;
  payTo: string;
  price: Price;
  network: Network;
  maxTimeoutSeconds?: number;
  extra?: Record<string, any>;

  // HTTP-specific metadata
  resource?: string;
  description?: string;
  mimeType?: string;
  customPaywallHtml?: string;
  discoverable?: boolean;
  inputSchema?: any;
  outputSchema?: any;
}
```

### RoutesConfig

**File**: `typescript/packages/core/src/http/x402HTTPResourceService.ts`

```typescript
type RoutesConfig = Record<string, RouteConfig> | RouteConfig;
```

**Usage**:
```typescript
// Single route (all paths)
const routes: RoutesConfig = {
  scheme: "exact",
  payTo: ADDRESS,
  price: "$0.001",
  network: "eip155:84532"
};

// Multiple routes
const routes: RoutesConfig = {
  "GET /free": undefined,  // Not configured = free
  "GET /premium": {
    scheme: "exact",
    payTo: ADDRESS,
    price: "$0.10",
    network: "eip155:84532"
  },
  "POST /expensive": {
    scheme: "exact",
    payTo: ADDRESS,
    price: "$1.00",
    network: "eip155:84532"
  }
};
```

### HTTPRequestContext

**File**: `typescript/packages/core/src/http/x402HTTPResourceService.ts`

```typescript
interface HTTPRequestContext {
  adapter: HTTPAdapter;
  path: string;
  method: string;
  paymentHeader?: string;
}
```

### HTTPProcessResult

**File**: `typescript/packages/core/src/http/x402HTTPResourceService.ts`

```typescript
type HTTPProcessResult =
  | { type: 'no-payment-required' }
  | { type: 'payment-verified'; paymentPayload: PaymentPayload; requirements: any }
  | { type: 'payment-error'; response: HTTPResponseInstructions };
```

**Usage in Middleware**:
```typescript
const result = await server.processHTTPRequest(context);

switch (result.type) {
  case 'no-payment-required':
    return next();  // Continue to route
  case 'payment-verified':
    // Execute route, then settle
    break;
  case 'payment-error':
    // Return 402 response
    break;
}
```

## EVM-Specific Types

### ExactEvmPayloadV2

**File**: `typescript/packages/mechanisms/evm/src/types.ts`

```typescript
type ExactEvmPayloadV2 = {
  authorization: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: `0x${string}`;
  };
  signature: `0x${string}`;
}
```

**Usage**:
```typescript
const payload: ExactEvmPayloadV2 = {
  authorization: {
    from: "0xABC...",
    to: "0x742d...",
    value: "1000",
    validAfter: "1730000000",
    validBefore: "1730000300",
    nonce: "0x1234567890abcdef..."
  },
  signature: "0xabcdef123456..."
};
```

## Configuration Types

### FetchWrapperConfig

**File**: `typescript/packages/http/fetch/src/index.ts`

```typescript
interface FetchWrapperConfig {
  schemes: SchemeRegistration[];
  paymentRequirementsSelector?: SelectPaymentRequirements;
}

interface SchemeRegistration {
  network: Network;
  client: SchemeNetworkClient;
  x402Version?: number;
}

type SelectPaymentRequirements = (
  x402Version: number,
  paymentRequirements: PaymentRequirements[]
) => PaymentRequirements;
```

**Usage**:
```typescript
const fetchWithPayment = wrapFetchWithPayment(fetch, {
  schemes: [
    {
      network: "eip155:8453",
      client: new ExactEvmClient(account),
      x402Version: 2
    }
  ],
  paymentRequirementsSelector: (version, options) => {
    // Custom logic to select from multiple options
    return options[0];  // Default: first option
  }
});
```

### PaywallConfig

**File**: `typescript/packages/core/src/http/x402HTTPResourceService.ts`

```typescript
interface PaywallConfig {
  cdpClientKey?: string;
  appName?: string;
  appLogo?: string;
  sessionTokenEndpoint?: string;
  currentUrl?: string;
  testnet?: boolean;
}
```

## Type Guards and Utilities

### Network Utilities

```typescript
// From utils
function parseNetwork(network: Network): { protocol: string; identifier: string } {
  const [protocol, identifier] = network.split(':');
  return { protocol, identifier };
}

// Example
const { protocol, identifier } = parseNetwork("eip155:8453");
// protocol = "eip155"
// identifier = "8453"
```

### Type Validation

All types are validated at runtime using zod schemas (not shown in implementation but common pattern).

## Next Steps

- **See Types in Action**: [Happy Path](../02-protocol-flows/happy-path.md)
- **Implementation Details**: [Client Implementation](./client-implementation.md)
- **Code Examples**: [Object Examples](../06-detailed-flows/object-examples.md)

---

*Reference: `typescript/packages/core/src/types/`*
