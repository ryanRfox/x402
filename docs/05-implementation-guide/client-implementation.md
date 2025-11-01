# Client Implementation

Method-by-method breakdown of client implementation.

## Core Methods

### wrapFetchWithPayment()

**Location**: `typescript/packages/http/fetch/src/index.ts:79`

Wraps fetch to automatically handle 402 responses.

**Flow**:
1. Make initial request
2. If 402, parse requirements
3. Select compatible scheme
4. Create payment payload
5. Retry with payment header

### createPaymentPayload()

**Location**: `typescript/packages/mechanisms/evm/src/exact/index.ts:15`

Creates payment authorization and signature.

**Steps**:
1. Build authorization object
2. Sign using EIP-712
3. Return PaymentPayload

### signAuthorization()

**Location**: `typescript/packages/mechanisms/evm/src/exact/index.ts:48`

Signs authorization using EIP-712 typed data.

**EIP-712 Structure**:
```typescript
domain: { name, version, chainId, verifyingContract }
types: { TransferWithAuthorization: [...] }
message: { from, to, value, validAfter, validBefore, nonce }
```

---

*Reference: `typescript/packages/http/fetch/` and `typescript/packages/mechanisms/evm/`*
