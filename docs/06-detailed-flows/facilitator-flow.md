# Facilitator Flow

Verification and settlement process with object examples.

## Verify Flow

### Input

**PaymentPayload**:
```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "eip155:84532",
  "payload": {
    "authorization": {...},
    "signature": "0xabcd..."
  },
  "accepted": {...}
}
```

**PaymentRequirements**:
```json
{
  "scheme": "exact",
  "network": "eip155:84532",
  "asset": "0x036CbD...",
  "amount": "1000",
  "payTo": "0x742d...",
  "maxTimeoutSeconds": 300,
  "extra": {"name": "USDC", "version": "2"}
}
```

### Verification Steps

1. Verify EIP-712 signature
2. Check recipient matches
3. Check amount sufficient
4. Check not expired
5. Check balance sufficient

### Output

**VerifyResponse**:
```json
{
  "isValid": true,
  "payer": "0xABC123..."
}
```

## Settle Flow

### Execution

```typescript
// Call smart contract
const tx = await writeContract({
  address: "0x036CbD...",
  abi: eip3009ABI,
  functionName: "transferWithAuthorization",
  args: [from, to, value, validAfter, validBefore, nonce, signature]
});

// Wait for confirmation
const receipt = await waitForTransactionReceipt({ hash: tx });
```

### Output

**SettleResponse**:
```json
{
  "success": true,
  "transaction": "0xdef456...",
  "network": "eip155:84532",
  "payer": "0xABC123..."
}
```

---

*See [Facilitator Implementation](../05-implementation-guide/facilitator-implementation.md)*
