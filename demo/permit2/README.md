# Permit2 Demo

Demonstrates Permit2 SignatureTransfer integration with the x402 payment protocol using `assetTransferMethod: "permit2"`.

## Key Concept: assetTransferMethod

This demo shows how to use **any ERC-20 token** with x402 by specifying the asset transfer method:

```typescript
const paymentRequirements = {
  scheme: "exact",                    // Same scheme as USDC
  network: "eip155:31337",
  asset: "0xYourToken",               // ANY ERC-20 token
  amount: "100000000",
  payTo: "0xRecipient",
  maxTimeoutSeconds: 300,
  extra: {
    assetTransferMethod: "permit2",   // Use Permit2 instead of EIP-3009
    facilitator: "0xFacilitator",     // Who will call permitTransferFrom
  },
};
```

## What This Demo Shows

1. **Direct Permit2 Flow** (`test-permit2-flow.ts`) - Raw viem calls showing how Permit2 works
2. **SDK Integration** (`test-sdk-permit2-flow.ts`) - Full x402 client/facilitator flow using `assetTransferMethod: "permit2"`

## Quick Start

### 1. Start Anvil

```bash
# Terminal 1: Start local Ethereum node
anvil
```

### 2. Deploy Test Token and Permit2

```bash
# Terminal 2: Deploy contracts

# Option A: Fork a network with Permit2 already deployed (recommended)
# Stop anvil and restart with fork:
# anvil --fork-url https://sepolia.base.org

# Option B: Deploy Permit2 to plain Anvil
gh repo clone Uniswap/permit2 /tmp/permit2
cd /tmp/permit2
forge script script/DeployPermit2.s.sol --rpc-url http://localhost:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# Note: "CreateCollision" error means Permit2 is already deployed - this is OK

# Deploy test token (from this demo directory)
cd /path/to/x402/demo/permit2
forge create --rpc-url http://localhost:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  contracts/TestToken.sol:TestToken

# Note the "Deployed to:" address from output, then approve Permit2:
cast send <TOKEN_ADDRESS> "approve(address,uint256)" \
  0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 3. Update Token Address

Edit `constants.ts` and set `USDEMO_ADDRESS` to your deployed token address.

### 4. Install Dependencies

```bash
npm install
# Or: pnpm install
```

### 5. Run the Demo

```bash
# Option A: Direct Permit2 flow (simpler, shows raw mechanics)
npm test
# Or: pnpm test

# Option B: Full x402 SDK integration
npm run test:sdk
# Or: pnpm test:sdk
```

## Expected Output

### Direct Flow (`test-permit2-flow.ts`)

```
============================================================
Permit2 SignatureTransfer Demo
============================================================

Configuration:
  Token:       0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  Permit2:     0x000000000022D473030F116dDEE9F6B43aC78BA3
  Chain ID:    31337
  Payer:       0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  Facilitator: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  Recipient:   0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
  Amount:      100 USDEMO

Step 1: Check initial balances
  Payer balance:     1000000 USDEMO
  Recipient balance: 0 USDEMO

Step 2: Client signs Permit2 SignatureTransfer
  Nonce:    <random>
  Deadline: <future timestamp>
  Signing EIP-712 message...
  Signature: 0x1234...abcd

Step 3: Facilitator executes permitTransferFrom
  Calling Permit2.permitTransferFrom()...
  Transaction hash: 0x...
  Status: success
  Gas used: ~80000

Step 4: Verify final balances
  Payer balance:     999900 USDEMO
  Recipient balance: 100 USDEMO

Verification:
  Payer sent:        100 USDEMO
  Recipient received: 100 USDEMO

SUCCESS: Permit2 SignatureTransfer worked correctly.
```

### SDK Flow (`test-sdk-permit2-flow.ts`)

Shows the same flow using x402 SDK with `assetTransferMethod: "permit2"`:
- Creates `x402Client` with exact EVM scheme (auto-detects Permit2 from requirements)
- Creates `x402Facilitator` with exact EVM scheme (handles both EIP-3009 and Permit2)
- Demonstrates how existing exact scheme supports arbitrary tokens via assetTransferMethod

## Files

| File | Description |
|------|-------------|
| `constants.ts` | Token addresses, Anvil accounts, EIP-712 types |
| `test-permit2-flow.ts` | Direct Permit2 demo (no SDK) |
| `test-sdk-permit2-flow.ts` | Full x402 SDK integration test |
| `package.json` | Dependencies (viem, x402 packages) |
| `tsconfig.json` | TypeScript configuration |
| `contracts/TestToken.sol` | Basic ERC-20 test token (no native permit) |
| `foundry.toml` | Foundry configuration for contract compilation |

## Permit2 Contract Address

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

Same CREATE2 address on all EVM chains.

## Anvil Test Accounts

| Account | Address | Private Key |
|---------|---------|-------------|
| Payer | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Facilitator | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Recipient | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

## Troubleshooting

### "Permit2 not deployed"

Run the Permit2 deployment script or fork a network that has it:

```bash
anvil --fork-url https://sepolia.base.org
```

### "Insufficient allowance"

Approve Permit2 for your token (see step 2).

### "Invalid signature"

Check that `CHAIN_ID` in `constants.ts` matches your Anvil chain ID (default: 31337).

## References

- [Uniswap Permit2 Docs](https://docs.uniswap.org/contracts/permit2/overview)
- [x402 Permit2 SDK Docs](../../docs/03-sdk-reference/mechanisms/evm-permit2.md)
- [Circle CPN Permit2 Blog](https://www.circle.com/blog/how-cpn-uses-permit2-to-simplify-and-secure-onchain-payments)
