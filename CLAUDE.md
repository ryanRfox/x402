# Claude Code Guidelines - x402 EVM Development

This file provides context for EVM development in x402, including Permit2 support for arbitrary ERC-20 tokens.

## Quick Context

The x402 EVM implementation supports ANY ERC-20 token using Uniswap's Permit2. This is the same approach Circle chose for CPN (Circle Payments Network).

**Key insight:** Use **SignatureTransfer** (not AllowanceTransfer) for payment settlement - it's more secure for one-time payment signatures.

## Local Development (V2 SDK)

**CRITICAL**: Never install x402 packages from npm - they are V1.

See `docs/LOCAL-DEVELOPMENT.md` for full details. Quick reference:

| Location | Protocol | Example |
|----------|----------|---------|
| Inside monorepo | `workspace:*` | `"@x402/core": "workspace:*"` |
| Outside monorepo | `file:` | `"@x402/core": "file:../typescript/packages/core"` |
| npm | **NEVER** | Do not use npm for x402 packages |

## Source of Truth

**CRITICAL**: The authoritative branch is `upstream/development-v2`. Always verify patterns against actual source code.

### Key Files

```
# EVM implementation
typescript/packages/mechanisms/evm/src/exact/client/scheme.ts
typescript/packages/mechanisms/evm/src/exact/server/scheme.ts
typescript/packages/mechanisms/evm/src/exact/facilitator/scheme.ts
typescript/packages/mechanisms/evm/src/types.ts
typescript/packages/mechanisms/evm/src/permit2/constants.ts

# Core abstractions
typescript/packages/core/src/client/x402Client.ts
typescript/packages/core/src/server/x402ResourceServer.ts
typescript/packages/core/src/facilitator/x402Facilitator.ts
typescript/packages/core/src/types/

# E2E patterns (how schemes are wired up)
e2e/clients/fetch/index.ts
e2e/servers/express/index.ts
e2e/facilitators/typescript/index.ts
```

## V2 API Patterns

**CRITICAL**: Use V2 registration patterns. Never use V1 class instantiation.

### Registration Pattern

```typescript
// Client
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

const client = new x402Client();
registerExactEvmScheme(client, { signer });

// Server
import { x402ResourceServer } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

// Facilitator
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";

const facilitator = new x402Facilitator();
registerExactEvmScheme(facilitator, { signer, networks: "eip155:*" });
```

### Wrong V1 Pattern (NEVER USE)

```typescript
// WRONG - V1 pattern
const client = new EvmClient(signer);
client.register("eip155:*", new SomeScheme());
```

## Permit2 via assetTransferMethod

Permit2 support is integrated into the `exact` scheme via the `extra.assetTransferMethod` field:

```typescript
const paymentRequirements = {
  scheme: "exact",                    // Use exact scheme
  network: "eip155:8453",
  asset: "0xYourToken",               // ANY ERC-20 token
  amount: "1000000",
  payTo: "0xRecipient",
  maxTimeoutSeconds: 300,
  extra: {
    assetTransferMethod: "permit2",   // Enables Permit2 (default: "eip3009")
    facilitator: "0xFacilitator",
  },
};
```

### When to Use Each Method

| assetTransferMethod | Token Support | Best For |
|---------------------|---------------|----------|
| `"eip3009"` (default) | EIP-3009 tokens (USDC) | Gas-optimized USDC payments |
| `"permit2"` | ANY ERC-20 token | Universal token support |

## Permit2 Technical Details

### Contract Address (Universal)

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

Same address on ALL EVM chains (Ethereum, Base, Optimism, Arbitrum, Polygon, etc.)

### SignatureTransfer vs AllowanceTransfer

Permit2 has two components. **Use SignatureTransfer for x402:**

| Component | Use Case | Security |
|-----------|----------|----------|
| **SignatureTransfer** | One-time transfers | High - no hanging approvals |
| AllowanceTransfer | Time-based approvals | Lower - Paraswap hack vector |

### EIP-712 Signature Structure

```typescript
const domain = {
  name: "Permit2",
  chainId: chainId,
  verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
};

const types = {
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" }
  ],
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

const message = {
  permitted: {
    token: tokenAddress,
    amount: amount
  },
  spender: facilitatorAddress,
  nonce: uniqueNonce,
  deadline: expirationTimestamp
};
```

## Network Identifiers

Use CAIP-2 format for all network references:

| Network | Identifier |
|---------|------------|
| Anvil (local) | `eip155:31337` |
| Base Sepolia | `eip155:84532` |
| Base Mainnet | `eip155:8453` |
| Ethereum Mainnet | `eip155:1` |

## Foundry Toolchain

This project uses **Foundry** for Ethereum development. Foundry provides:

| Tool | Purpose |
|------|---------|
| `forge` | Compile, test, and deploy Solidity contracts |
| `anvil` | Local Ethereum node (like Ganache/Hardhat node) |
| `cast` | CLI for contract interaction and chain queries |
| `chisel` | Solidity REPL for quick experiments |

### Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Essential Foundry Commands

```bash
# Compilation
forge build                          # Compile all contracts
forge build --watch                  # Watch mode

# Testing
forge test                           # Run all tests
forge test -vvv                      # Verbose output
forge test --match-test testName     # Run specific test

# Deployment
forge create ContractName --rpc-url $RPC --private-key $KEY
forge script script/Deploy.s.sol --rpc-url $RPC --broadcast

# Contract Interaction
cast call $ADDR "balanceOf(address)" $USER --rpc-url $RPC
cast send $ADDR "transfer(address,uint256)" $TO $AMT --rpc-url $RPC --private-key $KEY

# Chain Queries
cast balance $ADDR --rpc-url $RPC
cast receipt $TX_HASH --rpc-url $RPC
cast chain-id --rpc-url $RPC
```

## Anvil Integration

### Start with Fork (Recommended)

```bash
# Fork Base Sepolia - Permit2 already deployed
anvil --fork-url https://sepolia.base.org --chain-id 84532
```

### In TypeScript Tests

```typescript
import { createTestClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Anvil's first account
const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http("http://127.0.0.1:8545")
});

// Deploy test token, approve Permit2, test flow...
```

## Testing Strategy

### Unit Tests

```
typescript/packages/mechanisms/evm/src/exact/__tests__/
├── client.test.ts       # Payload creation (EIP-3009 and Permit2)
├── server.test.ts       # Requirement building
└── facilitator.test.ts  # Verification and settlement
```

### E2E Tests

Test flow:
1. Start Anvil fork
2. Deploy test token (basic ERC-20)
3. Approve Permit2 contract
4. Create client, server, facilitator
5. Execute full payment flow
6. Verify token balances changed

## Dependencies

```json
{
  "dependencies": {
    "viem": "^2.x"
  }
}
```

## Documentation

- `docs/03-sdk-reference/mechanisms/evm.md` - Main EVM docs (EIP-3009)
- `docs/03-sdk-reference/mechanisms/evm-permit2.md` - Permit2 via assetTransferMethod

## Reference Architecture: Circle CPN

Circle's CPN validates this approach at production scale:

1. **Master Approval**: User approves Permit2 once per token
2. **Per-Payment Signature**: User signs exact amount + facilitator + deadline
3. **Settlement**: PaymentSettlement contract (≈ facilitator) calls Permit2

> "The Relayer cannot pull funds itself - only the authorized spender (PaymentSettlement contract) can execute."

This maps directly to x402's model where the facilitator is the authorized spender.

**Source:** [Circle: How CPN Uses Permit2](https://www.circle.com/blog/how-cpn-uses-permit2-to-simplify-and-secure-onchain-payments)

## Commit Style

```
feat(evm): description of change

- Bullet point details
```

Sign commits: `git commit -s -m "..."`

## Questions? Check These First

1. **How does exact scheme work?** → Read `typescript/packages/mechanisms/evm/src/exact/`
2. **How are schemes registered?** → Read `typescript/packages/core/src/client/x402Client.ts`
3. **What's the payload format?** → Read `typescript/packages/core/src/types/protocol.ts`
4. **Permit2 details?** → [Uniswap Permit2 Docs](https://docs.uniswap.org/contracts/permit2/overview)

## Foundry MCP Server

A Foundry MCP server is available for enhanced Anvil/Forge/Cast integration.

**Package:** `@pranesh.asp/foundry-mcp-server`

### Available MCP Tools

| Category | Tools |
|----------|-------|
| **Anvil** | `anvil_start`, `anvil_stop`, `anvil_status` |
| **Cast** | `cast_call`, `cast_send`, `cast_balance`, `cast_receipt`, `cast_storage`, `cast_logs` |
| **Forge** | `forge_script`, `install_dependency` |
| **Files** | `create_solidity_file`, `read_file`, `list_files` |
| **Utils** | `convert_eth_units`, `compute_address`, `contract_size`, `estimate_gas` |

### Configuration

If the MCP server is configured, prefer using MCP tools over raw bash commands:

```
# Instead of:
anvil --fork-url https://sepolia.base.org

# Use MCP tool:
anvil_start with fork_url parameter
```

See `.cursor/mcp.json` for configuration.

## Research Pattern: GitHub CLI over WebFetch

**IMPORTANT:** When researching external code:

| Action | Tool | Example |
|--------|------|---------|
| Find articles/docs | WebSearch, WebFetch | Search for "Permit2 integration guide" |
| Read code from GitHub | **gh CLI** (NOT WebFetch) | `gh repo clone Uniswap/permit2 /tmp/permit2` |

```bash
# Clone repos to /tmp for local exploration
gh repo clone Uniswap/permit2 /tmp/permit2
gh repo clone dragonfly-xyz/useful-solidity-patterns /tmp/solidity-patterns

# Then read locally
cat /tmp/permit2/src/SignatureTransfer.sol
cat /tmp/permit2/src/interfaces/ISignatureTransfer.sol
```

**Why:** WebFetch on GitHub returns HTML wrappers, not raw code. Cloning gives you actual source files.

## Legacy Warning

**NEVER read or reference any path containing `/legacy/`** - these contain V1 implementations with incompatible patterns.
