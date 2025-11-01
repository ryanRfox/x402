# Payment Schemes

Deep dive into the "exact" payment scheme for EVM networks.

## Exact Scheme Overview

The "exact" scheme uses EIP-3009 `transferWithAuthorization` for gasless transfers.

## Why EIP-3009 Instead of approve()/transferFrom()?

x402 v2 deliberately uses **EIP-3009** (`transferWithAuthorization`) rather than the traditional ERC-20 `approve()`/`transferFrom()` flow or EIP-2612 permit.

### Advantages of EIP-3009

✅ **Single transaction** - Not a two-step approve → transferFrom process
✅ **Gasless for users** - Facilitator pays gas, not the user
✅ **No allowance management** - No need to manage or revoke token approvals
✅ **Built-in replay protection** - Single-use nonce prevents double-spending
✅ **Time-bounded** - Authorizations automatically expire
✅ **Atomic execution** - Transfer happens in one operation or reverts

### Why Not EIP-2612 (Permit) or Standard approve/transferFrom?

❌ **Two transactions required** - `permit()` or `approve()`, then `transferFrom()`, or complex multicall
❌ **User must pay gas** - Or requires meta-transaction infrastructure
❌ **msg.sender dependency** - Complicates batching and facilitator implementation
❌ **Allowance vulnerabilities** - Creates attack surface for front-running and approval exploits
❌ **More complex state** - Requires tracking and managing allowances

### EIP-3009 Background

EIP-3009 allows a payer to authorize a transfer that can be executed by anyone (the facilitator).

**Key Features**:
- Gasless for payer (facilitator pays gas)
- Single-use nonce prevents replay
- Time-bounded validity
- EIP-712 signatures

### Future Considerations

> **Note**: EIP-2612 permit may be considered in future versions to support **usage-based payments** where the exact amount isn't known at authorization time (e.g., LLM token generation, streaming data). This would require additional infrastructure for escrow and settlement.

## Authorization Structure

```typescript
{
  from: Address,      // Payer
  to: Address,        // Recipient
  value: uint256,     // Amount in smallest units
  validAfter: uint256, // Unix timestamp
  validBefore: uint256, // Unix timestamp
  nonce: bytes32      // Random nonce
}
```

## EIP-712 Typed Data

**Domain**:
```typescript
{
  name: "USD Coin",
  version: "2",
  chainId: 84532,
  verifyingContract: "0x036CbD..." // USDC contract
}
```

**Type**:
```typescript
{
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" }
  ]
}
```

---

*Reference: `typescript/packages/mechanisms/evm/src/exact/` and [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009)*
