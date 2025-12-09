# GitHub Issue

## Title

Roadmap: Arbitrary Token Support via Permit2 Settlement Contract

---

## Body

### Roadmap Item

This is a contribution proposal for **Arbitrary Token Support** from the [x402 Roadmap](https://github.com/coinbase/x402/blob/main/ROADMAP.md#later):

> Permit/Permit2/EIP-712 flows for non-3009 tokens within x402

### Goals

Extend the existing `exact` EVM scheme to support **any ERC-20 token** via Uniswap's Permit2, while **preserving x402's trust-minimization guarantees**.

### Problem Statement

EIP-3009 (used by USDC) includes the `to` field in the signed message, making it trust-minimized—the facilitator cannot redirect funds. However, Permit2's `permitTransferFrom()` does NOT include the recipient in the signature. The caller (facilitator) controls `transferDetails.to` at execution time.

**This creates a trust gap**: A malicious facilitator could redirect payments to themselves.

This concern was previously raised in #485 and explored via EIP-7702 in #576.

### Proposed Solution: Settlement Contract

Following the industry-standard pattern used by **UniswapX**, **Across Protocol**, and **ERC-7683**, we propose deploying a canonical **x402 Settlement Contract** that enforces recipient constraints on-chain.

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  TransparentUpgradeableProxy (canonical address per chain)  │
│    ├── implementation → X402SettlementV1                    │
│    └── admin → x402 Multisig                                │
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

### Related

- #705 - V2 SDK development
- #485 - Original Permit2 trust concern
- #576 - EIP-7702 alternative approach
- [UniswapX Reactor Pattern](https://github.com/Uniswap/UniswapX)
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
