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

## Supported Networks

| Network | Chain ID | Status | Token Address |
|---------|----------|--------|---------------|
| Anvil (local) | 31337 | Ready | Deploy locally |
| Radius Staging | 1223954 | Ready | `0x20B3A535DA00f6A7285AF25280a618b38B588b66` |
| Radius Testnet | 1223953 | Planned | - |
| Base Sepolia | 84532 | Planned | - |

## What This Demo Shows

1. **Direct Permit2 Flow** (`test-permit2-flow.ts`) - Raw viem calls showing how Permit2 works (Anvil only)
2. **SDK Integration** (`test-sdk-permit2-flow.ts`) - Full x402 client/facilitator flow (Anvil only)
3. **Multi-Network Test** (`test-permit2-network.ts`) - Permit2 on any supported network

## Quick Start: Local Anvil

### 1. Start Anvil

```bash
anvil
```

### 2. Deploy Test Token and Permit2

```bash
# Clone and deploy Permit2 (if not using fork)
gh repo clone Uniswap/permit2 /tmp/permit2
cd /tmp/permit2
forge script script/DeployPermit2.s.sol --rpc-url http://localhost:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# Note: "CreateCollision" error means Permit2 is already deployed - this is OK

# Deploy test token
cd /path/to/x402/demo/permit2
forge create --rpc-url http://localhost:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  contracts/TestToken.sol:TestToken

# Approve Permit2 (replace <TOKEN_ADDRESS> with deployed address)
cast send <TOKEN_ADDRESS> "approve(address,uint256)" \
  0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 3. Update Token Address

Edit `constants.ts` and set `USDEMO_ADDRESS` to your deployed token address.

### 4. Install and Run

```bash
npm install
npm test           # Direct Permit2 flow
npm run test:sdk   # SDK integration
```

## Quick Start: Radius Staging

### 1. Configure Environment

Create `.env` file:

```bash
PRIVATE_KEY=0x<your-private-key>
```

### 2. Fund Your Account

Get test ETH from a Radius faucet for address derived from your private key.

### 3. Run Tests

```bash
npm install
npm run test:network radius-staging
```

A test token is already deployed and approved at `0x20B3A535DA00f6A7285AF25280a618b38B588b66`.

## Deploying to New Networks

```bash
# Deploy token and approve Permit2
npm run deploy <network-name>
# Example: npm run deploy radius-testnet

# Then run tests
npm run test:network <network-name>
```

## Files

| File | Description |
|------|-------------|
| `networks.ts` | Network configurations (Anvil, Radius, Base Sepolia) |
| `constants.ts` | Anvil-specific constants (legacy, for local testing) |
| `test-permit2-flow.ts` | Direct Permit2 demo - Anvil only |
| `test-sdk-permit2-flow.ts` | x402 SDK integration - Anvil only |
| `test-permit2-network.ts` | Multi-network Permit2 test |
| `deploy-token.ts` | Deploy TestToken to any network |
| `contracts/TestToken.sol` | Basic ERC-20 test token |

## Expected Output

### Radius Staging (`npm run test:network radius-staging`)

```
============================================================
Permit2 SignatureTransfer Test - radius-staging
============================================================

Configuration:
  Network:     Radius Staging (eip155:1223954)
  Token:       0x20B3A535DA00f6A7285AF25280a618b38B588b66
  Permit2:     0x000000000022D473030F116dDEE9F6B43aC78BA3
  Payer:       0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204
  Facilitator: 0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204
  Recipient:   0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  Amount:      1 USDEMO

Step 1: Check initial balances
  Payer balance:     999999 USDEMO
  Recipient balance: 1 USDEMO
  Permit2 allowance: <max uint256> USDEMO

Step 2: Client signs Permit2 SignatureTransfer
  Signing EIP-712 message...

Step 3: Facilitator executes permitTransferFrom
  Transaction hash: 0x...
  Status: success

Step 4: Verify final balances
  Payer sent:         1 USDEMO
  Recipient received: 1 USDEMO

============================================================
SUCCESS: Permit2 SignatureTransfer on radius-staging
============================================================
```

## Permit2 Contract Address

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

Same CREATE2 address on all EVM chains including Radius.

## Anvil Test Accounts

| Account | Address | Private Key |
|---------|---------|-------------|
| Payer | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Facilitator | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Recipient | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

## Troubleshooting

### "Permit2 not deployed"

Permit2 is pre-deployed on most networks. For local Anvil, either fork a network or deploy manually.

### "Insufficient allowance"

Approve Permit2 for your token:

```bash
cast send <TOKEN> "approve(address,uint256)" \
  0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url <RPC_URL> --private-key <KEY>
```

### "PRIVATE_KEY environment variable required"

For testnets, create `.env` file with your private key.

## References

- [Uniswap Permit2 Docs](https://docs.uniswap.org/contracts/permit2/overview)
- [x402 Permit2 SDK Docs](../../docs/03-sdk-reference/mechanisms/evm-permit2.md)
- [Circle CPN Permit2 Blog](https://www.circle.com/blog/how-cpn-uses-permit2-to-simplify-and-secure-onchain-payments)
- [Radius Documentation](https://docs.tryradi.us/)
