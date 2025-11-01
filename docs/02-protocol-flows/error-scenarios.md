# Error Scenarios

This document covers common error scenarios and how the protocol handles them.

## Common Error Scenarios

### 1. Insufficient Balance

**What Happens**:
```typescript
// Facilitator verify check
const balance = await contract.balanceOf(payer);
if (balance < required) {
  return {
    isValid: false,
    invalidReason: "insufficient_funds",
    payer
  };
}
```

**Response**:
```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: {...}

{
  "error": "insufficient_funds"
}
```

### 2. Payment Expired

**What Happens**:
```typescript
const now = Math.floor(Date.now() / 1000);
if (BigInt(authorization.validBefore) < BigInt(now)) {
  return {
    isValid: false,
    invalidReason: "expired",
    payer
  };
}
```

### 3. Invalid Signature

**What Happens**:
```typescript
const recoveredAddress = await verifyTypedData({...});
if (!recoveredAddress) {
  return {
    isValid: false,
    invalidReason: "invalid_signature",
    payer
  };
}
```

### 4. Amount Mismatch

**What Happens**:
```typescript
if (BigInt(authorization.value) < BigInt(requirements.amount)) {
  return {
    isValid: false,
    invalidReason: "insufficient_amount",
    payer
  };
}
```

### 5. Network Mismatch

**What Happens**:
```typescript
if (payload.network !== requirements.network) {
  return {
    isValid: false,
    invalidReason: "network_mismatch",
    payer
  };
}
```

### 6. Transaction Failure

**What Happens** (Settlement):
```typescript
try {
  const tx = await writeContract({...});
  const receipt = await waitForTransactionReceipt({ hash: tx });

  if (receipt.status !== "success") {
    return {
      success: false,
      errorReason: "transaction_failed",
      transaction: tx,
      network, payer
    };
  }
} catch (error) {
  return {
    success: false,
    errorReason: "transaction_failed",
    transaction: "",
    network, payer
  };
}
```

### 7. Business Logic Error

**Special Case**: If route handler returns 4xx/5xx, payment is NOT settled:

```typescript
// From express middleware
if (res.statusCode >= 400) {
  // Skip settlement
  res.end = originalEnd;
  if (endArgs) originalEnd(...endArgs);
  return;
}

// Only settle on success
const settlementHeaders = await server.processSettlement(...);
```

## Error Response Format

### v2 Format (Header-based)

```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64-encoded-PaymentRequired>

{
  "error": "<error_reason>"
}
```

### PaymentRequired Object

```typescript
{
  x402Version: 2,
  error: "Payment required" | "insufficient_funds" | "expired" | ...,
  resource: {
    url: string,
    description: string,
    mimeType: string
  },
  accepts: PaymentRequirements[],
  extensions?: Record<string, any>
}
```

## Error Handling in Client

```typescript
// From @x402/fetch
const response = await fetchWithPayment(url);

if (response.status === 402) {
  // Payment was required but failed
  const error = await response.json();
  console.error("Payment failed:", error);
}

if (response.status === 200) {
  // Success
  const paymentResponse = response.headers.get('PAYMENT-RESPONSE');
  // Contains settlement details
}
```

## Reference Implementation

See `typescript/packages/mechanisms/evm/src/exact/index.ts:90-228` for verification error handling.

## Next Steps

- **Happy Path**: [Happy Path](./happy-path.md)
- **Network Variations**: [Network Variations](./network-variations.md)
