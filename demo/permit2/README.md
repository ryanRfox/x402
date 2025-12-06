# Permit2 Demo

Prototype and testing space for Permit2 integration with x402.

## Structure

```
demo/permit2/
├── contracts/       # Test Solidity contracts
├── scripts/         # Anvil deployment scripts
├── src/             # TypeScript experiments
└── README.md
```

## Prerequisites

### Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Verify installation:
```bash
forge --version    # Solidity compiler & testing
anvil --version    # Local Ethereum node
cast --version     # CLI for contract interaction
chisel --version   # Solidity REPL
```

## Foundry Command Reference

| Command | Purpose |
|---------|---------|
| `anvil` | Start local Ethereum node |
| `anvil --fork-url <URL>` | Fork existing network |
| `forge build` | Compile contracts |
| `forge test` | Run tests |
| `forge create` | Deploy contract |
| `forge script` | Run deployment scripts |
| `cast call` | Read contract (no tx) |
| `cast send` | Write contract (sends tx) |
| `cast balance` | Check ETH balance |
| `cast receipt` | Get transaction receipt |

## Quick Start

```bash
# Start Anvil (fork Base Sepolia for real Permit2)
anvil --fork-url https://sepolia.base.org --chain-id 84532

# Clone Permit2 for reference
gh repo clone Uniswap/permit2 /tmp/permit2
```

## Permit2 Contract Address

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

Same on all EVM chains.

## Deploy Test Token

```bash
# Deploy a basic ERC-20 (no native permit) to test Permit2 universality
forge create --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  contracts/TestToken.sol:TestToken

# Approve Permit2 for the token (one-time)
cast send $TOKEN_ADDRESS "approve(address,uint256)" \
  0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## References

- [.claude/PROMPT.arbitrary-token-support.md](../../.claude/PROMPT.arbitrary-token-support.md) - Task description
- [CLAUDE.md](../../CLAUDE.md) - Implementation guide
- [docs/LOCAL-DEVELOPMENT.md](../../docs/LOCAL-DEVELOPMENT.md) - V2 SDK usage
- [Circle CPN Permit2](https://www.circle.com/blog/how-cpn-uses-permit2-to-simplify-and-secure-onchain-payments)
- [Uniswap Permit2](https://github.com/Uniswap/permit2)
