# Facilitator Implementation

Method-by-method breakdown of facilitator implementation.

## Core Methods

### verify()

**Location**: `typescript/packages/mechanisms/evm/src/exact/index.ts:90`

Verifies payment without executing transaction.

**Checks**:
1. Signature validity (EIP-712)
2. Recipient matches
3. Amount sufficient
4. Not expired
5. Balance sufficient

### settle()

**Location**: `typescript/packages/mechanisms/evm/src/exact/index.ts:230`

Executes on-chain transaction.

**Steps**:
1. Re-verify payment
2. Parse signature (ERC-6492)
3. Call `transferWithAuthorization`
4. Wait for confirmation
5. Return result

---

*Reference: `typescript/packages/mechanisms/evm/src/exact/index.ts`*
