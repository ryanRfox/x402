# Analysis: Mechanism Cascade Architecture in V2 Spec

**Date**: December 13, 2025
**Status**: Analysis Complete
**Task**: Understand and formalize how mechanisms cascade from network → scheme → mechanism in the x402 V2 specification

## Executive Summary

The V2 specification defines payment requirements as a combination of `scheme`, `network`, `asset`, and `amount`, with mechanism-specific details currently buried in the optional `extra` field. However, **mechanisms are not formalized as a first-class concept** in the spec, creating ambiguity about:

1. Which mechanisms are valid for a given `(network, scheme)` combination
2. How mechanisms are advertised and negotiated between client and server
3. How the `/supported` endpoint should list mechanism capabilities
4. How gas sponsorship, approval requirements, and onboarding flows should be specified

This analysis proposes formalizing mechanisms as first-class in the spec's cascading constraint model.

---

## 1. Current V2 Specification Structure

### 1.1 PaymentRequirements Type

```typescript
type PaymentRequirements = {
  scheme: string;           // "exact", "deferred", etc.
  network: Network;         // "eip155:84532", "solana:*", etc.
  asset: string;           // Token address or ISO code
  amount: string;          // Atomic units
  payTo: string;           // Recipient address
  maxTimeoutSeconds: number; // Deadline
  extra: Record<string, unknown>; // ← Mechanisms hidden here
};
```

### 1.2 Current Extra Field Usage

Looking at e2e test configurations and code:

```json
{
  "scheme": "exact",
  "network": "eip155:84532",
  "asset": "0x4200000000000000000000000000000000000006",
  "amount": "1000000000000000",
  "payTo": "0x...",
  "maxTimeoutSeconds": 60,
  "extra": {
    "name": "WETH",
    "version": "2",
    "assetTransferMethod": "permit2"  // ← Mechanism hidden here!
  }
}
```

### 1.3 Problems with Current Approach

1. **No formal specification**: The V2 spec documents `extra` as "Scheme-specific additional information" but never lists what should be in `extra` or which fields are required
2. **No Permit2 documentation**: Permit2 is not mentioned anywhere in the V2 spec (checked by grep)
3. **Implicit negotiation**: Mechanisms are silently negotiated via `extra.assetTransferMethod` with zero formal spec
4. **Incomplete `/supported` endpoint**: The response lists `(scheme, network)` pairs but doesn't advertise which mechanisms are supported:

```json
{
  "kinds": [
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:84532"
      // ← Missing: which mechanisms are available? (EIP-3009 vs Permit2?)
    }
  ]
}
```

5. **Cascading constraints not formalized**: The concept that mechanisms are only valid for certain `(network, scheme)` combinations is intuitive but nowhere codified:
   - Permit2 is only valid for `eip155:*` + `exact` (it's an EVM thing)
   - TransferChecked is only valid for `solana:*` + `exact` (it's an SVM thing)
   - EIP-2612 might only be valid for specific tokens within `eip155:*` + `exact`

---

## 2. The Cascading Constraint Architecture (User's Insight)

The user correctly identified a hierarchical constraint model:

```
Network
  ↓ (which mechanisms are POSSIBLE?)
  ├─ eip155:* → Permit2, EIP-3009, EIP-2612
  └─ solana:* → TransferChecked

  Scheme
    ↓ (which mechanisms are APPLICABLE?)
    ├─ exact → uses authorization/signature-based transfer
    └─ deferred → uses different settlement model

  Mechanism
    ↓ (HOW to execute the transfer?)
    ├─ EIP-3009: TransferWithAuthorization (all ERC-20 with EIP-3009 support)
    ├─ Permit2: Signature-based transfer via settlement contract
    └─ EIP-2612: Token's native permit() method
```

**Key insight**: A mechanism is only valid if it satisfies all constraints above it:
- Permit2 on Solana ❌ (not possible - Solana doesn't have Permit2)
- TransferChecked on EVM ❌ (not possible - EVM doesn't have TransferChecked)
- Permit2 on EVM + exact ✅ (possible and applicable)

---

## 3. How Mechanisms Are Currently Implemented

### 3.1 In TypeScript SDK

**Server-side** (`typescript/packages/mechanisms/evm/src/exact/server/scheme.ts:52-78`):
```typescript
async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
  // If price is AssetAmount object, return with extra preserved
  if (typeof price === "object" && price !== null && "amount" in price) {
    return {
      amount: price.amount,
      asset: price.asset,
      extra: price.extra || {},  // ← assetTransferMethod passes through
    };
  }
  // ... fallback to USDC conversion
}
```

The server simply passes through whatever is in `extra.assetTransferMethod` without validation or documentation.

**Client-side** (`typescript/packages/mechanisms/evm/src/exact/client/scheme.ts`):
```typescript
async createPaymentPayload(
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): Promise<Pick<PaymentPayload, "x402Version" | "payload">> {
  const authorization = { from, to, value, validAfter, validBefore, nonce };
  const signature = await this.signAuthorization(authorization, paymentRequirements);
  // ← Does NOT inspect assetTransferMethod; uses EIP-3009 for all
}
```

The client doesn't actually read `extra.assetTransferMethod` - it just does EIP-712 signing.

**Facilitator-side** (`typescript/packages/mechanisms/evm/src/exact/facilitator/scheme.ts`):
```typescript
async settle(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<SettleResponse> {
  // Re-verify before settling
  const valid = await this.verify(payload, requirements);

  // Then dispatch to settlement logic
  // This is where mechanism selection would happen
  // but currently it's NOT specified

  const signature = exactEvmPayload.signature!;
  const signatureLength = signature.startsWith("0x") ? signature.length - 2 : signature.length;
  const isECDSA = signatureLength === 130;

  if (isECDSA) {
    // Use EIP-3009 path (parseSignature)
  } else {
    // Use smart wallet path (assumes ERC-1271)
  }
}
```

The facilitator chooses settlement mechanism based on **signature length**, not based on the declared `assetTransferMethod`.

### 3.2 Current Reality

- **Problem 1**: Client doesn't read mechanism declaration
- **Problem 2**: Facilitator doesn't read mechanism declaration
- **Problem 3**: Settlement is inferred from signature characteristics, not explicit specification
- **Problem 4**: Server can declare a mechanism in `extra` but nothing enforces it

---

## 4. Gap Analysis: What's Missing from the Spec

### 4.1 Permit2 Is Completely Undocumented

In the V2 spec (`specs/x402-specification-v2.md`):
- ✅ Section 6.1 documents "Exact Scheme (EVM overview)" with EIP-3009
- ✅ Section 6.2 documents "Exact Scheme (SVM overview)" with TransferChecked
- ❌ No section on Permit2
- ❌ No mention of settlement contracts
- ❌ No mention of assetTransferMethod
- ❌ No error codes for Permit2-specific failures

### 4.2 No Formalization of Mechanism Selection

The spec doesn't answer:
- How does a server advertise "I support EIP-3009 AND Permit2"?
- How does a client choose between multiple mechanisms?
- What does the `/supported` endpoint return for mechanisms?
- How do clients know if they need to approve a token before paying?

### 4.3 No Gas Sponsorship Specification

The spec doesn't cover:
- How facilitator sponsors client's approval transaction
- How client signals "I can't pay gas; please sponsor"
- What happens if approval fails vs settlement fails
- Whether facilitator must run approval atomically with settlement

### 4.4 No Onboarding Flow Specification

The spec doesn't address:
- Which mechanisms require pre-approval (Permit2 does for non-EIP-2612 tokens)
- Which mechanisms are gasless for the client (EIP-3009 is, Permit2 isn't)
- Error flows when prerequisites aren't met

---

## 5. Proposed Formalization

### 5.1 Add `mechanism` as First-Class Field

**Current V2 approach** (implicit, error-prone):
```json
{
  "scheme": "exact",
  "network": "eip155:84532",
  "asset": "0x...",
  "extra": { "assetTransferMethod": "permit2" }
}
```

**Proposed V2.1 approach** (explicit, formal):
```json
{
  "scheme": "exact",
  "network": "eip155:84532",
  "asset": "0x...",
  "mechanism": "permit2",
  "extra": {
    "requiresApproval": true,
    "approvalTarget": "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    "settlementContract": "0x..."
  }
}
```

### 5.2 Formal Mechanism Definitions

**For EVM exact scheme**:

| Mechanism | Description | Approval Required | Gasless for Client | Settlement | Extra Fields |
|-----------|-------------|-------------------|--------------------|------------|--------------|
| `eip3009` | EIP-3009 TransferWithAuthorization | No | Yes | Direct contract call | `name`, `version` |
| `permit2` | Uniswap Permit2 signature transfer | Yes (unless token has EIP-2612) | No | Via settlement contract | `settlementContract` |
| `eip2612` | Token's native permit() method | Conditional | Yes (via permit) | Direct contract call | `tokenHasPermit` |

**For SVM exact scheme**:

| Mechanism | Description | Approval Required | Gasless for Client | Settlement | Extra Fields |
|-----------|-------------|-------------------|--------------------|------------|--------------|
| `transferchecked` | SPL TransferChecked | Via fee payer | Depends on fee payer | Direct instruction | `feePayer` |

### 5.3 Enhanced `/supported` Endpoint

**Current response**:
```json
{
  "kinds": [
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:84532"
    }
  ]
}
```

**Proposed response**:
```json
{
  "kinds": [
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:84532",
      "mechanisms": ["eip3009", "permit2"],
      "mechanisms_details": {
        "eip3009": { "requiresApproval": false },
        "permit2": {
          "requiresApproval": true,
          "settlementContract": "0x..."
        }
      }
    }
  ]
}
```

This allows clients to understand:
- Which mechanisms are available for a given (scheme, network)
- Which ones require pre-approval
- Where to approve and where to settle

### 5.4 Updated Error Codes

Add mechanism-specific errors:
- `unsupported_mechanism` - mechanism declared in `extra.assetTransferMethod` is not available
- `mechanism_approval_required_but_not_provided` - Permit2 requires pre-approval
- `mechanism_approval_failed` - Client's approval transaction failed
- `mechanism_settlement_contract_invalid` - Settlement contract validation failed

---

## 6. Implementation Strategy

### Phase 1: Spec Formalization (No Code Changes)

1. Update `specs/x402-specification-v2.md` to:
   - Document Permit2 mechanism fully (settlement flow, error codes, constraints)
   - Define mechanism field formally
   - Explain cascading constraints model
   - Show `/supported` endpoint with mechanism details

2. Create `specs/mechanisms/evm-mechanisms.md` specifying:
   - EIP-3009 requirements and settlement
   - Permit2 requirements (approval, settlement contract, witness binding)
   - EIP-2612 requirements (token-specific)
   - Gas sponsorship semantics
   - Approval flows and error handling

3. Create `specs/mechanisms/svm-mechanisms.md` specifying:
   - TransferChecked requirements
   - Fee payer models

### Phase 2: SDK Implementation Changes

1. **Update TypeScript types** to include `mechanism` field
2. **Enhance SchemeNetworkServer interface** to validate mechanism/network/scheme combinations
3. **Update `/supported` endpoint** to advertise mechanisms and their requirements
4. **Add mechanism dispatch logic** in facilitator.settle() to route based on declared mechanism
5. **Formalize approval flow** - create separate method for handling pre-approvals
6. **Add error codes** for mechanism-specific failures

### Phase 3: E2E Test Updates

1. Create test endpoints for each mechanism (EIP-3009, Permit2, EIP-2612)
2. Test mechanism selection and negotiation
3. Test approval flows and gas sponsorship
4. Document prerequisites per mechanism

---

## 7. Why This Matters

### Current Pain Points

1. **For server operators**: Can't advertise which mechanisms they support beyond trial-and-error
2. **For client developers**: Can't know if they need to approve a token before attempting payment
3. **For facilitators**: Must infer settlement mechanism from signature characteristics instead of explicit declaration
4. **For spec readers**: No unified view of Permit2; scattered across code and comments

### What This Solves

1. **Clear negotiation**: Server explicitly declares `mechanism` in accepts array
2. **Client preparation**: Client reads mechanism requirements and pre-approves if needed
3. **Facilitator clarity**: Facilitator reads declared mechanism and routes accordingly
4. **Comprehensive spec**: Single source of truth for all mechanisms and their requirements
5. **Gas sponsorship**: Can formalize which flows support sponsorship and what's required
6. **Type safety**: TypeScript enforces valid `(network, scheme, mechanism)` tuples

---

## 8. Questions for User

Before proposing a full design document, I want to confirm:

1. **Backwards compatibility**: Should v2 spec remain unchanged and v2.1 introduce mechanisms? Or modify v2 before wider release?

2. **Approval sponsorship**: Should sponsorship be a per-mechanism setting in `extra`, or a separate field like `sponsorApproval: boolean`?

3. **Settlement contract address**: Should it be in `extra` or a top-level field? Should `/supported` endpoint return it?

4. **Priority order**: Should the spec formalize mechanism selection (e.g., "prefer Permit2 over EIP-3009")? Or is that client implementation detail?

5. **EIP-2612**: Should we include it now or wait until a token actually implements it?

---

## 9. Next Steps

Once you confirm direction on the above questions, I can:

1. **Write detailed spec additions** (sections 6.3 for EVM Permit2, new section 6.4 for mechanism selection)
2. **Design SDK changes** needed to enforce mechanism cascading
3. **Create migration guide** for existing servers/clients
4. **Plan e2e test structure** to validate all mechanism combinations
5. **Document gas sponsorship architecture** for the refactoring you discussed

This foundational work will unblock the major refactoring you outlined earlier (gas sponsorship, zero-fee client support, technical debt cleanup).
