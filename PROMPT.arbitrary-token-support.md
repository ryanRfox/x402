# Arbitrary Token Support - Implementation Prompt

## Overview

You are implementing **Arbitrary Token Support** for the x402 protocol using **Permit2**. Currently, x402 only supports EIP-3009 tokens (like USDC) which have native `transferWithAuthorization`. This effort extends support to ANY ERC-20 token using Uniswap's Permit2.

**Reference:** See `ROADMAP.md` "Later" section and "Explicit community call-outs".

## Why Permit2 (Not EIP-2612)

Circle's CPN (Circle Payments Network) faced the same choice and explicitly chose Permit2 over EIP-3009:

> "ERC-3009's design lived inside each token contract. Every asset that wanted this functionality had to implement its own `transferWithAuthorization` method. That fragmented the developer experience and limited interoperability."
>
> "Permit2, developed by Uniswap Labs, solves this by abstracting token approvals away from individual tokens into a shared contract."

**Source:** [Circle: How CPN Uses Permit2](https://www.circle.com/blog/how-cpn-uses-permit2-to-simplify-and-secure-onchain-payments)

### Token Coverage Comparison

| Mechanism | Coverage | Notes |
|-----------|----------|-------|
| EIP-3009 | ~0.1% | Essentially just USDC, EURC |
| EIP-2612 | ~5-20% | Newer tokens only |
| **Permit2** | **100%** | Any standard ERC-20 |

## Technical Background

### Current x402 Flow (EIP-3009)

```
Client signs transferWithAuthorization → Facilitator calls token.transferWithAuthorization()
```

Single atomic call. Token verifies signature and transfers.

### New Permit2 Flow

```
1. [One-time] User approves Permit2 contract for token (on-chain tx)
2. [Per-payment] Client signs EIP-712 Permit2 SignatureTransfer
3. [Settlement] Facilitator calls Permit2.permitTransferFrom() with signature
```

**IMPORTANT:** Use **SignatureTransfer** (not AllowanceTransfer) for payment settlement. SignatureTransfer creates one-time signatures with no "hanging approvals" - more secure for payments. The Paraswap hack (March 2024) exploited AllowanceTransfer's time-based approvals.

### Circle CPN Architecture (Reference Model)

Circle's CPN uses a two-level approval model directly applicable to x402:

1. **Master Approval**: User grants Permit2 an ERC-20 allowance (one-time)
2. **Sub-Approval**: For each payment, user signs temporary Permit2 signature with:
   - Exact amount
   - Specific spender (PaymentSettlement contract / x402 Facilitator)
   - Expiration time
   - Nonce

**Critical security property**: "The Relayer cannot pull funds itself" - only the authorized spender (facilitator) can execute.

## Scope of Work

### Phase 1: Research & Setup
1. Study Permit2 contract and SignatureTransfer interface
2. Set up Anvil local network
3. Deploy test ERC-20 token (standard, no native permit)
4. Test Permit2 approval and transfer flow manually

### Phase 2: Implementation
1. Create `@x402/evm/permit2/client` - signs Permit2 SignatureTransfer
2. Create `@x402/evm/permit2/server` - validates signature structure
3. Create `@x402/evm/permit2/facilitator` - calls Permit2.permitTransferFrom()

### Phase 3: E2E Testing
1. Add e2e tests with Anvil
2. Test with token that has NO native permit support
3. Verify full payment flow works

### Phase 4: Documentation
1. Document new scheme in `docs/03-sdk-reference/mechanisms/`
2. Add examples to `examples/typescript/`

## Permit2 Contract Details

### Address (Same on All Chains)

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

Deployed on: Ethereum, Base, Optimism, Arbitrum, Polygon, and most EVM chains.

### SignatureTransfer Interface

```solidity
struct TokenPermissions {
    address token;
    uint256 amount;
}

struct PermitTransferFrom {
    TokenPermissions permitted;
    uint256 nonce;
    uint256 deadline;
}

struct SignatureTransferDetails {
    address to;
    uint256 requestedAmount;
}

function permitTransferFrom(
    PermitTransferFrom memory permit,
    SignatureTransferDetails calldata transferDetails,
    address owner,
    bytes calldata signature
) external;
```

### EIP-712 Domain

```solidity
bytes32 constant DOMAIN_SEPARATOR = keccak256(
    abi.encode(
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
        keccak256("Permit2"),
        block.chainid,
        address(this) // Permit2 contract address
    )
);
```

### TypeHash for SignatureTransfer

```solidity
bytes32 constant PERMIT_TRANSFER_FROM_TYPEHASH = keccak256(
    "PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"
);
```

## Anvil Setup Guide

### Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Start Anvil (Fork Mode Recommended)

```bash
# Fork Base Sepolia to get real Permit2 contract
anvil --fork-url https://sepolia.base.org --chain-id 84532

# Or fork Base Mainnet
anvil --fork-url https://mainnet.base.org --chain-id 8453
```

Forking gives you the real Permit2 contract already deployed.

### Default Anvil Accounts

```
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Deploy Test Token

Create a basic ERC-20 (no permit support) to test Permit2 universality:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Intentionally NO permit support - tests Permit2 universality
contract TestToken is ERC20 {
    constructor() ERC20("Test Token", "TEST") {
        _mint(msg.sender, 1000000 * 10**18);
    }
}
```

### Test Flow

```bash
# 1. Deploy test token
forge create --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  contracts/TestToken.sol:TestToken

# 2. Approve Permit2 (one-time)
cast send $TOKEN_ADDRESS "approve(address,uint256)" \
  0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url http://localhost:8545 \
  --private-key $PRIVATE_KEY

# 3. Now Permit2 signatures will work for this token
```

## Key Source Files to Study

### x402 Existing EVM Implementation
```
typescript/packages/mechanisms/evm/src/exact/
├── client.ts      # How client signing works
├── server.ts      # How server verification works
├── facilitator.ts # How facilitator settlement works
└── types.ts       # Payload type definitions
```

### Permit2 Reference
```
# Clone for reference
git clone https://github.com/Uniswap/permit2

permit2/src/
├── SignatureTransfer.sol    # What we'll interact with
├── interfaces/
│   └── ISignatureTransfer.sol
└── libraries/
    └── PermitHash.sol       # EIP-712 hashing
```

## Expected Deliverables

1. **New scheme implementation:**
   ```
   typescript/packages/mechanisms/evm/src/permit2/
   ├── client.ts      # Signs Permit2 SignatureTransfer
   ├── server.ts      # Validates signature structure
   ├── facilitator.ts # Calls Permit2.permitTransferFrom()
   ├── types.ts       # Permit2Payload type
   └── index.ts       # Exports + registerPermit2EvmScheme()
   ```

2. **E2E tests:**
   - `e2e/tests/permit2.test.ts`

3. **Demo/prototype:**
   - `demo/permit2/` - Anvil scripts and test flows

4. **Documentation:**
   - `docs/03-sdk-reference/mechanisms/evm-permit2.md`

## Payload Type Definition

```typescript
interface Permit2Payload {
  x402Version: 2;
  scheme: "permit2";
  network: string;              // "eip155:84532"

  // Permit2 SignatureTransfer fields
  token: `0x${string}`;         // Token contract address
  amount: bigint;               // Amount in token units
  nonce: bigint;                // Unique nonce (non-sequential OK)
  deadline: bigint;             // Unix timestamp

  // Transfer details
  owner: `0x${string}`;         // Payer address (signer)
  spender: `0x${string}`;       // Facilitator address

  // EIP-712 signature
  signature: `0x${string}`;     // Full signature bytes
}
```

## Success Criteria

1. Client can sign Permit2 SignatureTransfer for ANY ERC-20 token
2. Facilitator can settle via Permit2.permitTransferFrom()
3. Works with tokens that have NO native permit support
4. E2E tests pass on Anvil fork
5. Documentation follows V2 patterns

## Implementation Resources

### Primary References
- [Uniswap Permit2 GitHub](https://github.com/Uniswap/permit2)
- [Uniswap Permit2 Docs](https://docs.uniswap.org/contracts/permit2/overview)
- [Permit2 Integration Guide](https://blog.uniswap.org/permit2-integration-guide)

### Circle CPN Reference (validates architecture)
- [How CPN Uses Permit2](https://www.circle.com/blog/how-cpn-uses-permit2-to-simplify-and-secure-onchain-payments)
- [CPN Developer Docs](https://developers.circle.com/cpn)

### Implementation Guides
- [Cyfrin: Full Guide to Implementing Permit2](https://www.cyfrin.io/blog/how-to-implement-permit2)
- [Dragonfly: Permit2 Patterns](https://github.com/dragonfly-xyz/useful-solidity-patterns/tree/main/patterns/permit2)

### Security
- [Matcha/0x: Why SignatureTransfer](https://blog.matcha.xyz/article/permit2)
- Paraswap hack (March 2024) - exploited AllowanceTransfer, not SignatureTransfer

## Research Pattern: GitHub CLI over WebFetch

**IMPORTANT:** When researching external code:

1. **DO use WebFetch/WebSearch** to find articles, blog posts, and documentation that reference GitHub repositories
2. **DO NOT use WebFetch** to read code directly from GitHub URLs
3. **DO use GitHub CLI (gh)** to clone repositories to `/tmp` for local exploration

```bash
# Clone Permit2 for local study
gh repo clone Uniswap/permit2 /tmp/permit2

# Clone useful patterns
gh repo clone dragonfly-xyz/useful-solidity-patterns /tmp/solidity-patterns

# Then explore locally
ls /tmp/permit2/src/
cat /tmp/permit2/src/SignatureTransfer.sol
```

**Why:** WebFetch on GitHub returns HTML wrappers, not raw code. Cloning gives you the actual source files for accurate study.

## Getting Started

1. Read `CLAUDE.arbitrary-token-support.md` for codebase navigation
2. Study existing `exact` scheme in `typescript/packages/mechanisms/evm/src/exact/`
3. Clone Permit2 locally: `gh repo clone Uniswap/permit2 /tmp/permit2`
4. Study `/tmp/permit2/src/SignatureTransfer.sol`
5. Start Anvil with Base fork: `anvil --fork-url https://sepolia.base.org`
6. Deploy test token and verify Permit2 flow manually
7. Begin implementation following existing scheme patterns
