# Client Payment Flow

Complete client execution with object examples at each step.

## Full Flow with Objects

### 1. Initial Request

```typescript
// User code
const response = await fetchWithPayment('http://localhost:4021/protected');
```

**HTTP Request**:
```http
GET /protected HTTP/1.1
Host: localhost:4021
```

### 2. Server Returns 402

**HTTP Response**:
```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOi...
```

**Decoded PaymentRequired**:
```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://localhost:4021/protected",
    "description": "",
    "mimeType": ""
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:84532",
    "asset": "0x036CbD...",
    "amount": "1000",
    "payTo": "0x742d...",
    "maxTimeoutSeconds": 300,
    "extra": { "name": "USDC", "version": "2" }
  }]
}
```

### 3. Create Payment

**PaymentPayload Created**:
```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "eip155:84532",
  "payload": {
    "authorization": {
      "from": "0xABC123...",
      "to": "0x742d35...",
      "value": "1000",
      "validAfter": "1730000000",
      "validBefore": "1730000300",
      "nonce": "0x1234567890abcdef..."
    },
    "signature": "0xabcdef123456..."
  },
  "accepted": { /* original requirements */ }
}
```

### 4. Retry with Payment

**HTTP Request**:
```http
GET /protected HTTP/1.1
Host: localhost:4021
PAYMENT-SIGNATURE: eyJ4NDAyVmVyc2lvbiI6Miwic2NoZW1lIjoi...
```

### 5. Receive Response

**HTTP Response**:
```http
HTTP/1.1 200 OK
PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJ0cmFuc2FjdGlvbiI6...

{
  "message": "Protected endpoint accessed successfully",
  "timestamp": "2024-10-24T12:00:00.000Z"
}
```

**Decoded PAYMENT-RESPONSE**:
```json
{
  "success": true,
  "transaction": "0xdef456789abc...",
  "network": "eip155:84532",
  "payer": "0xABC123..."
}
```

---

*See [Happy Path](../02-protocol-flows/happy-path.md) for complete step-by-step walkthrough*
