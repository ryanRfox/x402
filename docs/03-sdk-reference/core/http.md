# HTTP Utilities

HTTP header encoding and decoding utilities for the x402 protocol.

## Overview

The HTTP utilities module provides functions for encoding and decoding payment protocol data in HTTP headers. All protocol data is base64-encoded JSON for transport.

## Import

```typescript
import {
  encodePaymentSignatureHeader,
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  decodePaymentRequiredHeader,
  encodePaymentResponseHeader,
  decodePaymentResponseHeader
} from '@x402/core/http';
```

## Payment Signature Header

The `PAYMENT-SIGNATURE` header contains the client's payment payload.

### encodePaymentSignatureHeader()

```typescript
function encodePaymentSignatureHeader(
  paymentPayload: PaymentPayload
): string
```

**Example:**
```typescript
const payment = await client.createPaymentPayload(2, requirements);
const headerValue = encodePaymentSignatureHeader(payment);

await fetch(url, {
  headers: {
    'PAYMENT-SIGNATURE': headerValue
  }
});
```

### decodePaymentSignatureHeader()

```typescript
function decodePaymentSignatureHeader(
  paymentSignatureHeader: string
): PaymentPayload
```

**Example:**
```typescript
const paymentHeader = request.headers.get('PAYMENT-SIGNATURE');
if (paymentHeader) {
  const payment = decodePaymentSignatureHeader(paymentHeader);
  console.log('Payment from:', payment.network);
}
```

## Payment Required Header

The `PAYMENT-REQUIRED` header contains the server's payment requirements (402 response).

### encodePaymentRequiredHeader()

```typescript
function encodePaymentRequiredHeader(
  paymentRequired: PaymentRequired
): string
```

**Example:**
```typescript
const paymentRequired = service.createPaymentRequiredResponse(
  requirements,
  resourceInfo
);

return new Response(null, {
  status: 402,
  headers: {
    'PAYMENT-REQUIRED': encodePaymentRequiredHeader(paymentRequired)
  }
});
```

### decodePaymentRequiredHeader()

```typescript
function decodePaymentRequiredHeader(
  paymentRequiredHeader: string
): PaymentRequired
```

**Example:**
```typescript
const response = await fetch(url);
if (response.status === 402) {
  const headerValue = response.headers.get('PAYMENT-REQUIRED');
  if (headerValue) {
    const paymentRequired = decodePaymentRequiredHeader(headerValue);
    console.log('Accepts:', paymentRequired.accepts);
  }
}
```

## Payment Response Header

The `PAYMENT-RESPONSE` header contains settlement information after successful payment.

### encodePaymentResponseHeader()

```typescript
function encodePaymentResponseHeader(
  paymentResponse: SettleResponse
): string
```

**Example:**
```typescript
const settlement = await service.settlePayment(payment, requirements);

return new Response(data, {
  status: 200,
  headers: {
    'PAYMENT-RESPONSE': encodePaymentResponseHeader(settlement)
  }
});
```

### decodePaymentResponseHeader()

```typescript
function decodePaymentResponseHeader(
  paymentResponseHeader: string
): SettleResponse
```

**Example:**
```typescript
const response = await fetch(url, {
  headers: { 'PAYMENT-SIGNATURE': paymentHeader }
});

if (response.ok) {
  const settlementHeader = response.headers.get('PAYMENT-RESPONSE');
  if (settlementHeader) {
    const settlement = decodePaymentResponseHeader(settlementHeader);
    console.log('Transaction:', settlement.transaction);
  }
}
```

## Complete Flow Example

```typescript
import {
  encodePaymentSignatureHeader,
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader
} from '@x402/core/http';

// Client side
async function makeProtectedRequest(url: string) {
  let response = await fetch(url);

  if (response.status === 402) {
    // Decode payment requirements
    const headerValue = response.headers.get('PAYMENT-REQUIRED');
    const paymentRequired = decodePaymentRequiredHeader(headerValue!);

    // Create payment
    const selected = client.selectPaymentRequirements(
      paymentRequired.x402Version,
      paymentRequired.accepts
    );
    const payment = await client.createPaymentPayload(
      paymentRequired.x402Version,
      selected
    );

    // Retry with payment
    response = await fetch(url, {
      headers: {
        'PAYMENT-SIGNATURE': encodePaymentSignatureHeader(payment)
      }
    });

    // Check settlement
    if (response.ok) {
      const settlementHeader = response.headers.get('PAYMENT-RESPONSE');
      if (settlementHeader) {
        const settlement = decodePaymentResponseHeader(settlementHeader);
        console.log('Settled:', settlement.transaction);
      }
    }
  }

  return response;
}
```

## Base64 Encoding

All functions use URL-safe base64 encoding:
- Environment-aware (browser `btoa/atob` or Node.js `Buffer`)
- UTF-8 string encoding
- Validation regex: `/^[A-Za-z0-9+/]*={0,2}$/`

## Error Handling

All decode functions throw if given invalid input:

```typescript
try {
  const payment = decodePaymentSignatureHeader(headerValue);
} catch (error) {
  console.error('Invalid payment header:', error);
  // Handle malformed or tampered header
}
```

## Related Documentation

- [x402HTTPClient](./http-client.md) - Client HTTP methods
- [x402HTTPResourceService](./http-server.md) - Server HTTP methods
- [Type Definitions](./types.md) - Protocol types
