# GitHub Issue

## Title

Roadmap: Arbitrary Token Support via Permit2 Settlement Contract

---

## Body

### Roadmap Item

This is a contribution proposal for **Arbitrary Token Support** from the [x402 Roadmap](https://github.com/coinbase/x402/blob/main/ROADMAP.md#later):

> Permit/Permit2/EIP-712 flows for non-3009 tokens within x402

### Goals

Extend the existing `exact` EVM scheme to support **any ERC-20 token** using `permit2.permitWitnessTransferFrom()` while **preserving x402's trust-minimization guarantees**.

### Wallet Compatibility

This solution supports **all EVM wallet types**, not just EOAs:

| Wallet Type | Signature Method | Supported |
|-------------|------------------|-----------|
| **EOA** | ECDSA (`ecrecover`) | Yes |
| **ERC-4337 Smart Wallet** | ERC-1271 `isValidSignature` | Yes |
| **EIP-7702 Upgraded EOA** | ERC-1271 | Yes |
| **Gnosis Safe / Multisig** | ERC-1271 | Yes |

**How it works**: Permit2's `SignatureVerification` library automatically detects wallet type:

```solidity
if (claimedSigner.code.length == 0) {
    // EOA: verify via ecrecover
    address signer = ecrecover(hash, v, r, s);
} else {
    // Smart contract: verify via ERC-1271
    bytes4 magicValue = IERC1271(claimedSigner).isValidSignature(hash, signature);
}
```

This means 4337 wallets, Safe multisigs, and future 7702-upgraded EOAs can all use x402 Permit2 payments without any protocol changes. The only requirement is that the wallet implements ERC-1271 (which all major smart wallet standards require).

### Problem Statement

EIP-3009 (used by USDC) includes the `to` field in the signed message, making it trust-minimized (the facilitator cannot redirect funds). However, Permit2's `permitTransferFrom()` does NOT include the recipient in the signature. The caller (facilitator) controls `transferDetails.to` at execution time.

**This creates a trust gap**: A malicious facilitator could redirect payments to themselves.

This concern was previously raised in #485 and explored further via EIP-7702 in #576.

### Scope: V2 Only

This proposal targets **x402 V2 exclusively**. We are not pursuing backwards compatibility with V1 for the following reasons:

1. **V1 has no extensibility mechanism**: The V1 payload types are fixed to EIP-3009's `authorization` structure
2. **Clean separation of concerns**: V2's scheme registration pattern allows clean addition of new transfer methods
3. **Simpler implementation**: No need for complex version detection or migration paths
4. **Active development**: V2 is under active development (`development-v2` branch), making this the appropriate target

### Proposed Solution: Settlement Contract

Following the industry-standard pattern used by **UniswapX**, **Across Protocol**, and **ERC-7683**, we propose defining and deploying a canonical **x402 Settlement Contract** that enforces recipient constraints on-chain.

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  TransparentUpgradeableProxy (canonical address per chain)  │
│    ├── implementation → X402SettlementV1                    │
│    └── admin → x402 Multisig (x402 Foundation)              │
└─────────────────────────────────────────────────────────────┘
```

#### Two-Hop Transfer Flow

```
Payer signs: { token, amount, recipient: SELLER, paymentId, nonce, deadline }
                                    │
                                    ▼
        ┌───────────────────────────────────────────┐
        │  Permit2.permitWitnessTransferFrom()      │
        │    - Verifies signature covers witness    │
        │    - Transfers tokens to Settlement       │
        └───────────────────────────────────────────┘
                                    │
                                    ▼
        ┌───────────────────────────────────────────┐
        │  X402Settlement.executePayment()          │
        │    - Reads recipient from validated order │
        │    - Transfers to signed recipient        │
        └───────────────────────────────────────────┘
                                    │
                                    ▼
                      Tokens arrive at SELLER
```

**Why the facilitator cannot cheat**: If they modify the recipient, the order hash changes, Permit2's signature verification fails, and the transaction reverts.

### Trust Model Comparison

| Method | Recipient Enforcement | Trust Model |
|--------|----------------------|-------------|
| EIP-3009 | In signature (`to` field) | Trust-minimized |
| Permit2 (naive) | Facilitator chooses | Facilitator-trusted |
| **Permit2 + Settlement (proposed)** | **In witness, enforced by contract** | **Trust-minimized** |

### Deliverables

| Component | Deliverable |
|-----------|-------------|
| Settlement Contract | `X402Settlement.sol` with OpenZeppelin TransparentUpgradeableProxy |
| TypeScript SDK | Client, Server, Facilitator support for `assetTransferMethod: "permit2"` |
| E2E Tests | `/protected-permit2` endpoint with WETH on Base Sepolia |
| Documentation | Usage guide, security considerations, deployment addresses |

### Specification: `assetTransferMethod` Field

This proposal introduces a new field `extra.assetTransferMethod` to the EVM scheme. This field does not exist in the current V2 codebase and is being introduced as part of this proposal.

#### Type Definition

```typescript
type AssetTransferMethod = "eip3009" | "permit2";
```

#### Semantics

| Value | Transfer Mechanism | Trust Model |
|-------|-------------------|-------------|
| `"eip3009"` (default) | EIP-3009 `transferWithAuthorization` | Trust-minimized (recipient in signature) |
| `"permit2"` | Permit2 + Cononical Settlement Contract | Trust-minimized (recipient in witness) |

#### Default Behavior

When `extra.assetTransferMethod` is absent or undefined:
- **Server/Facilitator**: Assume `"eip3009"` (backwards compatible with existing V2 behavior)
- **Client**: Select based on server's `accepts` requirements

#### Wire Format

The field appears in the `extra` object of payment requirements:

```json
{
  "scheme": "exact",
  "network": "eip155:84532",
  "amount": "1000000000000000",
  "asset": "0x4200000000000000000000000000000000000006",
  "payTo": "0x...",
  "extra": {
    "assetTransferMethod": "permit2"
  }
}
```

### API Design

#### PAYMENT-REQUIRED Header

```typescript
accepts: {
  payTo: "0xSELLER",
  scheme: "exact",
  network: "eip155:84532",
  price: {
    amount: "1000000000000000",  // 0.001 WETH
    asset: "0x4200000000000000000000000000000000000006",
    extra: {
      assetTransferMethod: "permit2",
    },
  },
}
```

> **Note**: Settlement contract address is canonical per network—SDK resolves it automatically. No need to specify in `extra`.

#### Client Signing (EIP-712)

Client signs `PermitWitnessTransferFrom` with witness containing:

```typescript
PaymentOrder {
  token: address
  amount: uint256
  recipient: address    // Cryptographically enforced
  paymentId: bytes32    // Binds to specific resource
  nonce: uint256
  deadline: uint256
}
```

### Settlement Contract Design

```solidity
contract X402Settlement {
    ISignatureTransfer public immutable permit2;

    struct PaymentOrder {
        address token;
        uint256 amount;
        address recipient;   // Enforced on-chain
        bytes32 paymentId;
        uint256 nonce;
        uint256 deadline;
    }

    function executePayment(
        PaymentOrder calldata order,
        address payer,
        bytes calldata signature
    ) external {
        // 1. Call Permit2 with witness (tokens → this contract)
        permit2.permitWitnessTransferFrom(...);

        // 2. Transfer to signed recipient (enforced)
        ERC20(order.token).transfer(order.recipient, order.amount);
    }
}
```

Full implementation: ~100 lines, follows UniswapX patterns.

### Deployment Strategy

1. **Testnet first**: Base Sepolia, Ethereum Sepolia
2. **Upgradeable proxy**: TransparentUpgradeableProxy (OpenZeppelin)
3. **Multisig admin**: x402 maintainers control upgrades
4. **CREATE2 deployment**: Same address across all chains
5. **Audit required**: Before mainnet deployment

### Gas Analysis

| Approach | Gas Cost | Overhead |
|----------|----------|----------|
| Direct Permit2 | ~20,000 | — |
| Settlement Contract | ~26,000 | +30% (~$0.21 at 10 gwei) |

The security benefit (trust-minimization) outweighs the marginal gas cost.

### Draft Implementation Branch

`ryanrfox/x402:feature/evm-exact-permit2`

### Questions for Maintainers

1. Should this target `development-v2` or wait for #705 to merge?
2. Any concerns with the settlement contract governance model (upgradeable proxy + multisig)?
3. Preferred location for contract code: `/contracts` in this repo or separate repo?
4. Should we align with ERC-7683 struct definitions for cross-chain compatibility?

### Alternatives Considered

#### 1. Naive Permit2 (#485)

**PR**: #485 by @chongqiangchen

This PR proposed using Permit2's `permitTransferFrom()` directly, where the facilitator would call Permit2 and specify the recipient at execution time.

**Why Rejected**: @erikreppel-cb [correctly identified](https://github.com/coinbase/x402/pull/485#pullrequestreview-2680055610) that this violates x402's trust-minimization principles:

> "The crux of the trust-minimizing property of x402 is that all payment schemes must not allow for the facilitator or resource server to move funds, other than in accordance with client intentions."

With naive Permit2, the facilitator controls `transferDetails.to`, allowing fund redirection.

**Our Solution**: Use Permit2's `permitWitnessTransferFrom()` with a `PaymentOrder` witness that cryptographically binds the recipient into the signature, then enforce via cononical settlement contract.

#### 2. EIP-7702 Smart Wallet (#576)

**PR**: #576 by @AmazingAng (WTF Academy)

This approach proposed using EIP-7702 to convert EOAs into smart wallets, enabling complex authorization logic including recipient binding.

**Status**: Still being explored.

**Why We Chose Settlement Contract First**:
- **Broader compatibility**: Works with any EOA, no wallet upgrade required
- **Battle-tested pattern**: UniswapX, Across Protocol use this approach in production
- **Simpler deployment**: Single contract deployment per chain
- **Immediate usability**: Works today on all EVM chains with Permit2

**Important**: These approaches are **complementary, not mutually exclusive**. As noted in "Wallet Compatibility" above, our Permit2 settlement contract already supports EIP-7702 upgraded wallets via ERC-1271. A user with a 7702 wallet can use `assetTransferMethod: "permit2"` today. A future `assetTransferMethod: "eip7702"` could offer an alternative flow that bypasses Permit2 entirely, but this is additive.

#### 3. ERC Standards Research

We investigated several ERC standards for trust-minimized token transfers:

| Standard | Approach | Limitation |
|----------|----------|------------|
| EIP-3009 | `transferWithAuthorization` | USDC-only (requires token support) |
| ERC-2612 | `permit` + `transferFrom` | Doesn't bind recipient in signature |
| EIP-7702 | Smart wallet authorization | Requires wallet upgrade, new standard |

**Conclusion**: Permit2 with witness is the most practical solution for arbitrary ERC-20 support while maintaining trust-minimization.

### Related

- #705 - V2 SDK development
- #485 - Original Permit2 trust concern (naive approach, rejected)
- #576 - EIP-7702 alternative approach (under exploration)
- [UniswapX Reactor Pattern](https://github.com/Uniswap/UniswapX)
- [Across Protocol SpokePool](https://github.com/across-protocol/contracts)
- [ERC-7683: Cross Chain Intents](https://eips.ethereum.org/EIPS/eip-7683)

---

## Research Documentation

Comprehensive research supporting this proposal is available in the implementation branch:

- `PERMIT2-WITNESS-DATA.md` - Analysis of Permit2 witness mechanism
- `PERMIT2-ENFORCEMENT-PATTERNS.md` - How UniswapX/Across achieve trust-minimization
- `PERMIT2-SETTLEMENT-CONTRACT-RESEARCH.md` - Detailed settlement contract design
- `ERC-TRANSFER-STANDARDS-RESEARCH.md` - Survey of ERC standards for trust-minimized transfers

---

Happy to discuss the approach or adjust based on feedback.
