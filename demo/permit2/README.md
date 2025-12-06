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

## Quick Start

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

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

## References

- [PROMPT.arbitrary-token-support.md](../../PROMPT.arbitrary-token-support.md) - Task description
- [CLAUDE.arbitrary-token-support.md](../../CLAUDE.arbitrary-token-support.md) - Implementation guide
- [Circle CPN Permit2](https://www.circle.com/blog/how-cpn-uses-permit2-to-simplify-and-secure-onchain-payments)
- [Uniswap Permit2](https://github.com/Uniswap/permit2)
