# Type Definitions

Complete TypeScript type reference for the x402 core protocol.

## Import

```typescript
import type {
  PaymentPayload,
  PaymentRequirements,
  PaymentRequired,
  VerifyResponse,
  SettleResponse,
  SupportedResponse,
  Network,
  Price,
  AssetAmount
} from '@x402/core/types';
```

## Payment Types

### PaymentPayload

The payment created by a client to pay for a resource.

```typescript
type PaymentPayload = {
  x402Version: number;           // Protocol version (2)
  scheme: string;                // Payment scheme ('exact')
  network: Network;              // Network identifier
  payload: Record<string, any>;  // Scheme-specific payment data
  accepted: PaymentRequirements; // The requirements being paid
  extensions?: Record<string, any>;
}
```

**Example:**
```typescript
{
  x402Version: 2,
  scheme: 'exact',
  network: 'eip155:8453',
  payload: {
    signature: '0x...',
    message: {
      amount: '100000',
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
    }
  },
  accepted: { /* full requirements */ }
}
```

### PaymentRequirements

The requirements a server expects for payment.

```typescript
type PaymentRequirements = {
  scheme: string;              // Payment scheme
  network: Network;            // Network identifier
  asset: string;               // Asset/token address
  amount: string;              // Amount in smallest unit
  payTo: string;               // Recipient address
  maxTimeoutSeconds: number;   // Signature expiry
  extra: Record<string, any>;  // Scheme-specific data
}
```

**Example:**
```typescript
{
  scheme: 'exact',
  network: 'eip155:8453',
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  amount: '100000', // 0.10 USDC (6 decimals)
  payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  maxTimeoutSeconds: 300,
  extra: {
    signerAddress: '0x...',
    verifyingContract: '0x...'
  }
}
```

### PaymentRequired

The 402 response from a server requiring payment.

```typescript
type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: PaymentRequirements[];
  extensions?: Record<string, any>;
}
```

**Example:**
```typescript
{
  x402Version: 2,
  error: 'Payment required',
  resource: {
    url: 'https://api.example.com/data',
    description: 'Premium API endpoint',
    mimeType: 'application/json'
  },
  accepts: [
    { /* payment requirements option 1 */ },
    { /* payment requirements option 2 */ }
  ]
}
```

## Facilitator Types

### VerifyResponse

Response from verifying a payment.

```typescript
type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}
```

**Example:**
```typescript
{
  isValid: true,
  payer: '0x1234...'
}
```

### SettleResponse

Response from settling a payment on-chain.

```typescript
type SettleResponse = {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: Network;
}
```

**Example:**
```typescript
{
  success: true,
  payer: '0x1234...',
  transaction: '0xabcd...',
  network: 'eip155:8453'
}
```

### SupportedResponse

Response from facilitator's `/supported` endpoint.

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

**Example:**
```typescript
{
  kinds: [
    {
      x402Version: 2,
      scheme: 'exact',
      network: 'eip155:8453',
      extra: {
        signerAddress: '0x...'
      }
    }
  ],
  extensions: ['session-tokens']
}
```

## Common Types

### Network

Network identifier in CAIP-2 format.

```typescript
type Network = `${string}:${string}`;
```

**Examples:**
- `'eip155:1'` - Ethereum Mainnet
- `'eip155:8453'` - Base
- `'eip155:84532'` - Base Sepolia
- `'solana:mainnet'` - Solana Mainnet
- `'solana:devnet'` - Solana Devnet

### Price

User-friendly price format.

```typescript
type Money = string | number;
type AssetAmount = {
  asset: string;
  amount: string;
  extra?: Record<string, any>;
};
type Price = Money | AssetAmount;
```

**Examples:**
```typescript
// Simple formats (parsed by scheme)
'$0.10'
'0.10'
0.10

// Explicit format
{
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: '100000',
  extra: {}
}
```

### AssetAmount

Explicit asset and amount specification.

```typescript
type AssetAmount = {
  asset: string;               // Asset/token identifier
  amount: string;              // Amount in smallest unit
  extra?: Record<string, any>; // Additional metadata
}
```

## Mechanism Interfaces

### SchemeNetworkClient

Interface for client-side payment scheme implementations.

```typescript
interface SchemeNetworkClient {
  readonly scheme: string;

  createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements
  ): Promise<PaymentPayload>;
}
```

### SchemeNetworkFacilitator

Interface for facilitator payment scheme implementations.

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

### SchemeNetworkService

Interface for server-side payment scheme implementations.

```typescript
interface SchemeNetworkService {
  readonly scheme: string;

  parsePrice(
    price: Price,
    network: Network
  ): AssetAmount;

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

## HTTP Types

### ResourceConfig

Server resource configuration.

```typescript
interface ResourceConfig {
  scheme: string;              // e.g., 'exact'
  payTo: string;               // Payment recipient
  price: Price;                // Resource price
  network: Network;            // Payment network
  maxTimeoutSeconds?: number;  // Default: 300
}
```

### ResourceInfo

Resource metadata for PaymentRequired responses.

```typescript
interface ResourceInfo {
  url: string;         // Resource URL
  description: string; // Human-readable description
  mimeType: string;    // Content type
}
```

## V1 Backward Compatibility Types

For backward compatibility with V1 facilitators and legacy integrations, the core package exports V1 type definitions.

**Import Path**: `@x402/core/types/v1`

```typescript
import type {
  PaymentRequirementsV1,
  PaymentRequiredV1,
  PaymentPayloadV1,
  VerifyRequestV1,
  SettleRequestV1,
  SettleResponseV1,
  SupportedResponseV1
} from '@x402/core/types/v1';
```

### V1 Types

#### `PaymentRequirementsV1`

V1 payment requirements include resource information directly in the requirements object.

```typescript
type PaymentRequirementsV1 = {
  scheme: string;
  network: Network;
  maxAmountRequired: string;     // V1 uses "maxAmountRequired" instead of "amount"
  resource: string;               // Resource URL (moved to PaymentRequired in V2)
  description: string;            // Resource description (moved to PaymentRequired in V2)
  mimeType: string;               // Content type (moved to PaymentRequired in V2)
  outputSchema: Record<string, any>;  // V1-specific field
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: Record<string, any>;
}
```

**Key Differences from V2**:
- Uses `maxAmountRequired` instead of `amount`
- Includes `resource`, `description`, `mimeType` directly (V2 moves these to `PaymentRequired.resource`)
- Includes `outputSchema` field (removed in V2)

#### `PaymentRequiredV1`

V1 402 Payment Required response structure.

```typescript
type PaymentRequiredV1 = {
  x402Version: 1;
  error?: string;
  accepts: PaymentRequirementsV1[];
}
```

**Key Differences from V2**:
- No `resource` field (included in each `PaymentRequirementsV1` instead)
- No `extensions` support

#### `PaymentPayloadV1`

V1 payment payload created by clients.

```typescript
type PaymentPayloadV1 = {
  x402Version: 1;
  scheme: string;
  network: Network;
  payload: Record<string, any>;
}
```

**Key Differences from V2**:
- No `accepted` field (V2 includes full requirements being paid)
- No `extensions` support

#### `VerifyRequestV1` / `SettleRequestV1`

V1 facilitator request format.

```typescript
type VerifyRequestV1 = {
  paymentPayload: PaymentPayloadV1;
  paymentRequirements: PaymentRequirementsV1;
}

type SettleRequestV1 = {
  paymentPayload: PaymentPayloadV1;
  paymentRequirements: PaymentRequirementsV1;
}
```

**Key Differences from V2**:
- V2 adds top-level `x402Version` field to requests

#### `SettleResponseV1` / `SupportedResponseV1`

V1 facilitator response types (identical to V2).

```typescript
type SettleResponseV1 = {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: Network;
}

type SupportedResponseV1 = {
  kinds: {
    x402Version: number;
    scheme: string;
    network: Network;
    extra?: Record<string, any>;
  }[];
  extensions: string[];
}
```

### When to Use V1 Types

**Use V1 types when**:
- Integrating with legacy V1 facilitators that haven't upgraded to V2
- Maintaining backward compatibility with existing V1 clients
- Supporting gradual migration from V1 to V2 in production systems
- Working with systems that require V1-specific fields like `outputSchema`

**Use V2 types for**:
- All new implementations
- V2-native facilitators
- Modern x402 integrations
- Systems requiring extension support (e.g., bazaar, session-tokens)

### Migration from V1 to V2

#### Client Migration

**V1 Client Code**:
```typescript
const paymentPayload: PaymentPayloadV1 = {
  x402Version: 1,
  scheme: 'exact',
  network: 'eip155:8453',
  payload: { signature: '0x...', message: {...} }
};
```

**V2 Client Code**:
```typescript
const paymentPayload: PaymentPayload = {
  x402Version: 2,
  scheme: 'exact',
  network: 'eip155:8453',
  payload: { signature: '0x...', message: {...} },
  accepted: requirements  // Include full requirements being paid
};
```

#### Server Migration

**V1 Requirements**:
```typescript
const requirements: PaymentRequirementsV1 = {
  scheme: 'exact',
  network: 'eip155:8453',
  maxAmountRequired: '100000',  // V1 field name
  resource: '/protected',       // Resource info in requirements
  description: 'Protected endpoint',
  mimeType: 'application/json',
  outputSchema: {},
  payTo: '0x...',
  maxTimeoutSeconds: 300,
  asset: '0x...',
  extra: {}
};
```

**V2 Requirements**:
```typescript
const paymentRequired: PaymentRequired = {
  x402Version: 2,
  error: 'Payment required',
  resource: {                   // Resource info moved here
    url: '/protected',
    description: 'Protected endpoint',
    mimeType: 'application/json'
  },
  accepts: [{
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '100000',           // Renamed from maxAmountRequired
    payTo: '0x...',
    maxTimeoutSeconds: 300,
    asset: '0x...',
    extra: {}                   // outputSchema removed
  }]
};
```

#### Key Migration Steps

1. **Update field names**: `maxAmountRequired` → `amount`
2. **Restructure resource info**: Move `resource`, `description`, `mimeType` from requirements to `PaymentRequired.resource`
3. **Add accepted field**: Include full requirements in payment payload
4. **Remove V1-specific fields**: `outputSchema` no longer used
5. **Add extensions support**: Leverage V2 extensions like bazaar
6. **Update facilitator requests**: Add top-level `x402Version` field

#### Dual-Version Support

To support both V1 and V2 simultaneously:

```typescript
import type { PaymentPayload } from '@x402/core/types';
import type { PaymentPayloadV1 } from '@x402/core/types/v1';

function handlePayment(payload: PaymentPayload | PaymentPayloadV1) {
  if (payload.x402Version === 1) {
    // Handle V1 payment
    const v1Payload = payload as PaymentPayloadV1;
    // ...
  } else if (payload.x402Version === 2) {
    // Handle V2 payment
    const v2Payload = payload as PaymentPayload;
    // ...
  }
}
```

## Type Guards

### Checking Payment Version

```typescript
function isV2Payment(payload: PaymentPayload): boolean {
  return payload.x402Version === 2;
}
```

### Validating Network Format

```typescript
function isValidNetwork(network: string): network is Network {
  return /^[^:]+:[^:]+$/.test(network);
}
```

### Checking Required Fields

```typescript
function isValidPaymentRequirements(
  obj: any
): obj is PaymentRequirements {
  return (
    typeof obj === 'object' &&
    typeof obj.scheme === 'string' &&
    typeof obj.network === 'string' &&
    typeof obj.asset === 'string' &&
    typeof obj.amount === 'string' &&
    typeof obj.payTo === 'string' &&
    typeof obj.maxTimeoutSeconds === 'number' &&
    typeof obj.extra === 'object'
  );
}
```

## Related Documentation

- [x402Client](./client.md) - Client implementation
- [x402ResourceService](./server.md) - Server implementation
- [EVM Types](../mechanisms/evm.md#types) - EVM-specific types
- [SVM Types](../mechanisms/svm.md#types) - Solana-specific types
