# HTTPFacilitatorClient

HTTP client for communicating with remote x402 facilitator services.

## Overview

`HTTPFacilitatorClient` implements the `FacilitatorClient` interface for HTTP-based facilitators. It handles:
- Payment verification requests
- Payment settlement requests
- Supported kinds discovery
- Optional authentication

## Import

```typescript
import { HTTPFacilitatorClient } from '@x402/core/server';
```

## Class Definition

```typescript
export class HTTPFacilitatorClient implements FacilitatorClient {
  constructor(config?: FacilitatorConfig);

  async verify(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<VerifyResponse>;

  async settle(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<SettleResponse>;

  async getSupported(): Promise<SupportedResponse>;
}
```

## Configuration

```typescript
interface FacilitatorConfig {
  url?: string;  // Default: 'https://x402.org/facilitator'
  createAuthHeaders?: () => Promise<{
    verify: Record<string, string>;
    settle: Record<string, string>;
    supported: Record<string, string>;
  }>;
}
```

## Constructor Examples

### Default Facilitator

```typescript
const client = new HTTPFacilitatorClient();
// Uses: https://x402.org/facilitator
```

### Custom URL

```typescript
const client = new HTTPFacilitatorClient({
  url: 'https://facilitator.example.com'
});
```

### With Authentication

```typescript
const client = new HTTPFacilitatorClient({
  url: 'https://private-facilitator.example.com',
  createAuthHeaders: async () => ({
    verify: { 'Authorization': `Bearer ${await getToken()}` },
    settle: { 'Authorization': `Bearer ${await getToken()}` },
    supported: { 'Authorization': `Bearer ${await getToken()}` }
  })
});
```

## Methods

### verify()

Verifies a payment with the facilitator.

```typescript
async verify(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse>
```

**HTTP Request:**
- Endpoint: `POST /verify`
- Body:
  ```json
  {
    "x402Version": 2,
    "paymentPayload": { ... },
    "paymentRequirements": { ... }
  }
  ```

**Example:**
```typescript
const verifyResult = await client.verify(paymentPayload, requirements);
if (verifyResult.isValid) {
  console.log('Valid payment from:', verifyResult.payer);
}
```

### settle()

Settles a payment on-chain through the facilitator.

```typescript
async settle(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<SettleResponse>
```

**HTTP Request:**
- Endpoint: `POST /settle`
- Body:
  ```json
  {
    "x402Version": 2,
    "paymentPayload": { ... },
    "paymentRequirements": { ... }
  }
  ```

**Example:**
```typescript
const settleResult = await client.settle(paymentPayload, requirements);
if (settleResult.success) {
  console.log('Transaction:', settleResult.transaction);
}
```

### getSupported()

Fetches supported payment kinds from the facilitator.

```typescript
async getSupported(): Promise<SupportedResponse>
```

**HTTP Request:**
- Endpoint: `GET /supported`

**Example:**
```typescript
const supported = await client.getSupported();
console.log('Supported kinds:', supported.kinds);
console.log('Extensions:', supported.extensions);
```

## Error Handling

All methods throw on HTTP errors:

```typescript
try {
  await client.verify(payment, requirements);
} catch (error) {
  console.error('Facilitator error:', error.message);
  // Example: "Facilitator verify failed (400): Invalid signature"
}
```

## BigInt Handling

The client automatically converts BigInt values to strings for JSON transport:

```typescript
const payment = {
  payload: {
    amount: 100000n  // Converted to "100000"
  }
};

await client.verify(payment, requirements);
```

## Complete Example

```typescript
import { HTTPFacilitatorClient } from '@x402/core/server';
import { x402ResourceService } from '@x402/core/server';
import { ExactEvmService } from '@x402/evm';

// Setup facilitator client
const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL,
  createAuthHeaders: async () => {
    const token = await getApiToken();
    const authHeader = { 'Authorization': `Bearer ${token}` };
    return {
      verify: authHeader,
      settle: authHeader,
      supported: authHeader
    };
  }
});

// Use with resource service
const service = new x402ResourceService(facilitatorClient);
service.registerScheme('eip155:8453', new ExactEvmService());

await service.initialize();

// Service now uses the custom facilitator
const result = await service.verifyPayment(payment, requirements);
```

## Multiple Facilitators

The resource service supports multiple facilitators with fallback:

```typescript
const service = new x402ResourceService([
  new HTTPFacilitatorClient({ url: 'https://primary.example.com' }),
  new HTTPFacilitatorClient({ url: 'https://fallback.example.com' })
]);

// During initialization, first facilitator to respond gets precedence
await service.initialize();
```

## Related Documentation

- [x402Facilitator](./facilitator.md) - Local facilitator implementation
- [x402ResourceService](./server.md) - Server implementation
- [FacilitatorClient Interface](./types.md#facilitatorclient) - Interface definition
