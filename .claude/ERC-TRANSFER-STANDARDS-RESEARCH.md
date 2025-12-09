# ERC Standards for Trust-Minimized ERC-20 Transfers

**Research Date:** 2025-12-09
**Context:** Finding alternatives to Permit2 for trust-minimized token transfers in x402

---

## Executive Summary

**No single standard solves all use cases.** The best approach for x402 is multi-standard support based on token availability:

| Standard | Recipient Enforced? | Token Support | Complexity | Recommendation |
|----------|-------------------|---------------|------------|----------------|
| **EIP-3009** | ✅ In signature | Limited (USDC) | Low | Use for USDC ✓ |
| **Permit2 + Settlement** | ✅ In contract | Universal | Medium | Deploy contracts |
| **EIP-7702** | ✅ In delegated code | Universal | High | Future (2025+) |
| **EIP-4337** | ✅ In account | Universal | High | Optional support |

**Key Finding:** EIP-7702 is the most promising new standard for universal trust-minimized transfers, but it's very new (Pectra upgrade, 2025). For now, the multi-standard approach (EIP-3009 for USDC, Permit2 + settlement for others) remains best practice.

---

## 1. Standards Inventory

### 1.1 EIP-3009: TransferWithAuthorization (TRUE Trust-Minimization)

**Status:** Production (USDC, Circle FiatToken v2)

**How it works:**
```solidity
function transferWithAuthorization(
    address from,
    address to,        // ← RECIPIENT IN SIGNATURE
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s
) external;
```

**Trust Model:** Recipient address is CRYPTOGRAPHICALLY ENFORCED in signature. The facilitator cannot change `to` - it's part of the signed message.

**Key Advantages over EIP-2612:**
- Uses random 32-byte nonces (allows concurrent transactions)
- Includes recipient in signed data
- Single-step atomic transfer (not approve + transferFrom)

**Limitation:** Only tokens implementing EIP-3009 (mainly USDC)

**x402 Status:** Already implemented ✓

---

### 1.2 EIP-2612: Permit (NOT Trust-Minimized)

**Status:** Widely adopted

**How it works:**
```solidity
function permit(
    address owner,
    address spender,   // ← Only spender, no recipient
    uint256 value,
    uint256 deadline,
    uint8 v, bytes32 r, bytes32 s
) external;
```

**Trust Model:** ❌ NOT trust-minimized. Only sets allowance - spender (facilitator) can then call `transferFrom` to ANY address.

**Why x402 shouldn't use directly:** Same problem as Permit2 - facilitator can redirect funds.

---

### 1.3 Permit2 (Universal but Requires Settlement Contract)

**Status:** Industry standard (>3.1M addresses approved)

**Trust Model:**
- WITHOUT settlement contract = facilitator trusted
- WITH settlement contract = trust-minimized

**The Problem:** Permit2 signature does NOT include final recipient - only includes spender (facilitator).

**The Solution:** Deploy settlement contract that:
1. Receives tokens via Permit2
2. Reads recipient from signed order (witness data)
3. Forwards to correct recipient

**x402 Status:** Implemented without settlement contract (vulnerable)

---

### 1.4 EIP-7702: Set EOA Account Code (NEW - Most Promising)

**Status:** LIVE on mainnet (Pectra upgrade, 2025)

**How it works:**
1. EOA signs an "authorization" to delegate to a contract
2. For the duration of that transaction, EOA behaves like the contract
3. Contract logic enforces transfer constraints
4. Delegation can be revoked anytime

```solidity
// User authorizes delegation to PaymentController
authorization = {
    chainId: 1,
    address: PaymentController,  // Contract code to use
    nonce: 0,
}

// PaymentController enforces:
function executePayment(address token, uint256 amount, address recipient) external {
    require(authorizedRecipients[recipient], "Unauthorized recipient");
    IERC20(token).transfer(recipient, amount);
}
```

**Trust Model:** ✅ Trust-minimized - delegated contract enforces recipient constraints. Facilitator can trigger but cannot redirect.

**Advantages:**
- No account migration needed (keeps EOA)
- Works with any ERC-20
- Flexible logic (spending limits, time restrictions, whitelisted recipients)
- User can revoke delegation anytime

**Disadvantages:**
- Very new (less battle-tested)
- User education required
- Delegated code has FULL account access (security risk if contract is malicious)
- Wallet support still emerging

**x402 Consideration:** Promising for V3, but wait for ecosystem maturity.

---

### 1.5 EIP-4337: Account Abstraction (Complete but Complex)

**Status:** Live on mainnet

**How it works:**
- User deploys smart contract wallet (instead of EOA)
- Wallet has programmable validation logic
- Can enforce recipient constraints, spending limits, etc.
- Paymasters can sponsor gas fees in ERC-20 tokens

**Trust Model:** ✅ Trust-minimized - user's smart account controls all transfer logic.

**Limitation:** Requires account migration (EOA → smart account)

**x402 Consideration:** Support as optional payer method, not core requirement.

---

### 1.6 EIP-7683: Cross-Chain Intents (Draft)

**Status:** Draft (used by Across Protocol)

**How it works:**
- Standard format for cross-chain orders
- Recipient is explicit field in order struct
- Settlement contract enforces outputs match signed order

**Relevance to x402:** Similar solver/facilitator pattern. The standard shows how industry handles recipient enforcement (settlement contracts).

---

## 2. Deep Dive: Why EIP-3009 is Trust-Minimized

### The Key Difference

**EIP-2612 (Permit):**
```
User signs: "I authorize SPENDER to take up to VALUE tokens"
            ↓
Spender can send tokens ANYWHERE
```

**EIP-3009 (TransferWithAuthorization):**
```
User signs: "Transfer VALUE tokens FROM me TO recipient"
            ↓
Tokens can ONLY go to signed recipient
```

### EIP-712 Message Comparison

**EIP-2612:**
```javascript
{
  owner: "0xUser",
  spender: "0xFacilitator",  // WHO can move
  value: 1000000,
  nonce: 0,
  deadline: 1234567890
  // NO recipient field!
}
```

**EIP-3009:**
```javascript
{
  from: "0xUser",
  to: "0xSeller",            // WHERE tokens go - ENFORCED
  value: 1000000,
  validAfter: 0,
  validBefore: 1234567890,
  nonce: "0x..."             // Random 32-byte nonce
}
```

### Variant: receiveWithAuthorization

EIP-3009 also defines `receiveWithAuthorization` where ONLY the recipient can submit:

```solidity
function receiveWithAuthorization(
    address from,
    address to,        // Must equal msg.sender
    uint256 value,
    ...
) external {
    require(to == msg.sender, "Caller must be recipient");
    // ... execute transfer
}
```

This prevents front-running attacks where someone intercepts the signature.

---

## 3. Deep Dive: EIP-7702 for x402

### How It Could Work

**Step 1:** User delegates EOA to "X402PaymentController"
```javascript
const authorization = {
  chainId: 84532,  // Base Sepolia
  address: X402PaymentController.address,
  nonce: await user.getTransactionCount(),
};
const signature = await user.signAuthorization(authorization);
```

**Step 2:** X402PaymentController enforces constraints
```solidity
contract X402PaymentController {
    function executePayment(
        address token,
        uint256 amount,
        address recipient,
        bytes32 paymentId
    ) external {
        // Only facilitator can call
        require(authorizedFacilitators[msg.sender], "Unauthorized");

        // Recipient must be pre-authorized (from signed payment request)
        require(authorizedPayments[paymentId].recipient == recipient, "Wrong recipient");
        require(authorizedPayments[paymentId].amount == amount, "Wrong amount");

        // Execute transfer
        IERC20(token).transfer(recipient, amount);

        // Mark as used
        delete authorizedPayments[paymentId];
    }
}
```

**Step 3:** Facilitator triggers payment
```javascript
// Facilitator calls, but contract enforces recipient
await x402Controller.executePayment(
  WETH_ADDRESS,
  paymentAmount,
  sellerAddress,  // Must match pre-authorized
  paymentId
);
```

### Security Considerations

**Risk:** Delegated contract has FULL access to EOA's assets.

**Mitigations:**
1. Only delegate to audited, trusted contracts
2. Use time-limited delegations
3. Provide clear revocation UI
4. Implement spending limits in controller

---

## 4. Alternative Patterns

### 4.1 Settlement Contract Pattern (Industry Standard)

Used by: UniswapX, Across, ERC-7683

```
User → Permit2 → Settlement Contract → Recipient
```

The settlement contract:
1. Receives tokens via Permit2
2. Parses signed order to extract intended recipient
3. Enforces transfer to that recipient

**Pros:** Works with any Permit2-approved token
**Cons:** Requires contract deployment, two-hop transfer (more gas)

### 4.2 Escrow Pattern

```
User → Escrow → (conditions met) → Recipient
```

Tokens held in escrow until conditions verified. Used in:
- Gnosis Safe modules
- Time-locked transfers
- Conditional payments

**Cons:** Longer settlement time, locked capital

### 4.3 Flash Loan Pattern

Not applicable to x402 - flash loans require same-block repayment.

### 4.4 L2-Specific Patterns

Some L2s have native features:
- **Optimism/Base:** Same EVM, no special patterns
- **zkSync:** Native account abstraction (AA by default)
- **StarkNet:** Cairo-based AA

---

## 5. Comparison Matrix

| Standard | Recipient Enforced | Token Support | Gas Cost | Complexity | Wallet Support | Production Ready |
|----------|-------------------|---------------|----------|------------|----------------|------------------|
| **EIP-3009** | ✅ Cryptographic | Limited (USDC) | Low (~50k) | Low | ✅ Universal | ✅ Yes |
| **Permit2** | ❌ None | Universal | Low (~60k) | Low | ✅ Universal | ✅ Yes |
| **Permit2 + Settlement** | ✅ Contract | Universal | Medium (~100k) | Medium | ✅ Universal | ✅ Yes |
| **EIP-7702** | ✅ Delegated | Universal | Medium (~80k) | High | ⚠️ Emerging | ⚠️ New (2025) |
| **EIP-4337** | ✅ Account | Universal | High (~150k+) | High | ⚠️ Limited | ✅ Yes |

---

## 6. Recommendations for x402

### Short-Term (Current)
1. **Keep EIP-3009 for USDC** - truly trust-minimized
2. **Document Permit2 trust model** - users should know facilitator is trusted
3. **Don't claim trust-minimization for Permit2** without settlement contract

### Medium-Term (V2.x)
Add settlement contract support:
```typescript
extra: {
  assetTransferMethod: "permit2",
  settlementContract: "0x...",  // Optional: enforce recipient
}
```

Deploy settlement contracts on key chains (Base, Ethereum, Optimism).

### Long-Term (V3 - 2025 Q3+)
Evaluate **EIP-7702 integration** after:
- Major wallets support it (MetaMask, Coinbase Wallet, Rainbow)
- Security best practices established
- Multiple audited reference implementations
- 6+ months of mainnet usage

---

## 7. Security Considerations

### Signature Phishing (All Permit-Based Standards)
- **Risk:** $55M+ stolen in permit phishing attacks (Scam Sniffer data)
- **Mitigation:** Clear EIP-712 display, short deadlines, user education

### Front-Running (EIP-3009)
- **Risk:** Attacker can front-run `transferWithAuthorization`
- **Mitigation:** Use `receiveWithAuthorization` (only recipient submits)

### EIP-7702 Delegation Risks
- **Risk:** Delegated contract has unrestricted account access
- **Mitigation:** Only delegate to audited contracts, clear revocation UI

### Permit2 Allowance Accumulation
- **Risk:** Users often approve max uint256, leaving permanent exposure
- **Mitigation:** Use time-limited approvals, educate users

---

## 8. References

### EIP Specifications
- [EIP-2612: Permit Extension](https://eips.ethereum.org/EIPS/eip-2612)
- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [EIP-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [EIP-7702: Set EOA Account Code](https://eips.ethereum.org/EIPS/eip-7702)
- [EIP-7683: Cross-Chain Intents](https://eips.ethereum.org/EIPS/eip-7683)

### Implementation Guides
- [EIP-7702 Overview](https://eip7702.io/)
- [QuickNode: EIP-7702 Guide](https://www.quicknode.com/guides/ethereum-development/smart-contracts/eip-7702-smart-accounts)
- [OpenZeppelin: EOA Delegation](https://docs.openzeppelin.com/contracts/5.x/eoa-delegation)
- [Tenderly: EIP-7702 Explained](https://blog.tenderly.co/how-eip-7702-gives-eoas-smart-contract-functionalities/)

### Security Research
- [Permit2 Risk Analysis - Eocene](https://eocene.medium.com/permit2-introduction-and-risk-analysis-f9444b896fc5)
- [Uniswap Permit2 Audit - ChainSecurity](https://www.chainsecurity.com/security-audit/uniswap-permit2)

### Related x402 Research
- [PERMIT2-WITNESS-DATA.md](./PERMIT2-WITNESS-DATA.md)
- [PERMIT2-ENFORCEMENT-PATTERNS.md](./PERMIT2-ENFORCEMENT-PATTERNS.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-09
