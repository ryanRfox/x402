# x402HTTPClient

HTTP-specific extensions for the x402 client, providing header encoding/decoding methods.

## Overview

`x402HTTPClient` extends `x402Client` with HTTP-specific functionality for handling payment protocol headers.

## Import

```typescript
import { x402HTTPClient } from '@x402/core/client';
```

## Class Definition

```typescript
export class x402HTTPClient extends x402Client {
  encodePaymentSignatureHeader(
    paymentPayload: PaymentPayload
  ): Record<string, string>;

  getPaymentRequiredResponse(
    headers: Record<string, string>,
    body?: PaymentRequired
  ): PaymentRequired;

  getPaymentSettleResponse(
    headers: Record<string, string>
  ): SettleResponse;
}
```

## Methods

### encodePaymentSignatureHeader()

Encodes a payment payload into HTTP headers.

```typescript
encodePaymentSignatureHeader(
  paymentPayload: PaymentPayload
): Record<string, string>
```

**Returns:**
- V2: `{ 'PAYMENT-SIGNATURE': '...' }`

**Example:**
```typescript
const payment = await client.createPaymentPayload(2, requirements);
const headers = client.encodePaymentSignatureHeader(payment);

await fetch(url, { headers });
```

### getPaymentRequiredResponse()

Extracts payment requirements from a 402 response.

```typescript
getPaymentRequiredResponse(
  headers: Record<string, string>,
  body?: PaymentRequired
): PaymentRequired
```

**Example:**
```typescript
const response = await fetch(url);
if (response.status === 402) {
  const paymentRequired = client.getPaymentRequiredResponse(
    Object.fromEntries(response.headers.entries())
  );
}
```

### getPaymentSettleResponse()

Extracts settlement information from a successful response.

```typescript
getPaymentSettleResponse(
  headers: Record<string, string>
): SettleResponse
```

**Example:**
```typescript
const response = await fetch(url, {
  headers: client.encodePaymentSignatureHeader(payment)
});

if (response.ok) {
  const settlement = client.getPaymentSettleResponse(
    Object.fromEntries(response.headers.entries())
  );
  console.log('Transaction:', settlement.transaction);
}
```

## Complete Example

```typescript
import { x402HTTPClient } from '@x402/core/client';
import { ExactEvmClient } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');
const client = new x402HTTPClient();

client.registerScheme('eip155:*', new ExactEvmClient(account));

async function makeRequest(url: string) {
  let response = await fetch(url);

  if (response.status === 402) {
    const paymentRequired = client.getPaymentRequiredResponse(
      Object.fromEntries(response.headers.entries())
    );

    const selected = client.selectPaymentRequirements(
      paymentRequired.x402Version,
      paymentRequired.accepts
    );

    const payment = await client.createPaymentPayload(
      paymentRequired.x402Version,
      selected
    );

    const headers = client.encodePaymentSignatureHeader(payment);

    response = await fetch(url, { headers });

    if (response.ok) {
      const settlement = client.getPaymentSettleResponse(
        Object.fromEntries(response.headers.entries())
      );
      console.log('Settled:', settlement.transaction);
    }
  }

  return response;
}
```

## Related Documentation

- [x402Client](./client.md) - Base client implementation
- [HTTP Utilities](./http.md) - Low-level encoding functions
- [Fetch Integration](../http-adapters/fetch.md) - Ready-to-use fetch wrapper
