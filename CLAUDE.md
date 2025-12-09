# Claude Code Guidelines - E2E Testing for EVM Permit2

This file provides context for extending the e2e test framework to support Permit2.

## Current Task

**Add Permit2 support to the e2e test framework.** See `.claude/PROMPT-evm-exact-permit2.md` for full requirements.

## Status

- [x] E2E environment configured and working (see `.claude/SUMMARY-E2E-ENV-SETUP.md`)
- [x] EIP-3009 (USDC) tests passing
- [x] HTTP payment flow understood (see `.claude/SUMMARY-HTTP-CAPTURE.md`, `.claude/SUMMARY-PAYMENT-REQUIRED.md`)
- [x] `/protected-permit2` endpoint added with WETH + permit2
- [x] Settlement contract implemented and tested (see `.claude/CODE-REVIEW-PERMIT2-SETTLEMENT.md`)
- [x] E2E tests passing on Anvil fork (both USDC and Permit2 settlement)
- [ ] **TODO: Deploy settlement contract to Base Sepolia**

## Quick Context

The x402 SDK already supports Permit2 via `extra.assetTransferMethod: "permit2"`. The demo at `demo/permit2/` validates it works. Now we need to integrate into the main e2e tests at `/e2e`.

## CRITICAL: Client Selection Behavior

**The client selects which payment option to use from the server's `accepts` array.**

The TypeScript client selection algorithm:
1. Filter to supported networks
2. **Prefer USDC over other tokens** (hardcoded preference)
3. Return first USDC match, or first match if no USDC

**THIS MEANS**: If you offer both USDC and WETH in the `accepts` array, the client will ALWAYS pick USDC and ignore WETH!

**SOLUTION**: The Permit2 test endpoint MUST offer **ONLY WETH** - never include USDC as an option.

See `.claude/SUMMARY-PAYMENT-REQUIRED.md` for full details on client selection logic.

## E2E Framework Architecture

### Scenario Generation

```
Scenarios = Client × Server × Endpoint × Facilitator × ProtocolFamily
```

Components are discovered from directories with `test.config.json` files.

### Key Files

```
e2e/
├── test.ts                    # Main orchestration (763 lines)
├── src/
│   ├── types.ts               # TestEndpoint, TestConfig interfaces
│   └── discovery.ts           # Cartesian product scenario builder
├── clients/
│   └── fetch/
│       ├── index.ts           # Fetch client with x402
│       └── test.config.json
├── servers/
│   └── express/
│       ├── index.ts           # Express server with paymentMiddleware
│       └── test.config.json   # Endpoint definitions
└── facilitators/
    └── typescript/
        ├── index.ts           # TypeScript facilitator
        └── test.config.json
```

### Environment Variables

```bash
# Current e2e env vars (all 6 required)
CLIENT_EVM_PRIVATE_KEY=0x...
CLIENT_SVM_PRIVATE_KEY=...
SERVER_EVM_ADDRESS=0x...          # Receives payments
SERVER_SVM_ADDRESS=...
FACILITATOR_EVM_PRIVATE_KEY=0x... # Executes settlements
FACILITATOR_SVM_PRIVATE_KEY=...
```

**Note**: SERVER uses ADDRESS not PRIVATE_KEY in current design.

### TestEndpoint Schema

```typescript
interface TestEndpoint {
  path: string;
  method: string;
  description: string;
  requiresPayment?: boolean;
  protocolFamily?: "evm" | "svm";  // Used for filtering
  networks?: string[];
  health?: boolean;
  close?: boolean;
}
```

**Important**: No `scheme`, `assetTransferMethod`, or `asset` fields in TestEndpoint.

## Server Endpoint Pattern

The server uses `paymentMiddleware` with route configurations:

```typescript
// e2e/servers/express/index.ts
app.use(paymentMiddleware({
  "GET /protected": {
    accepts: {
      payTo: EVM_PAYEE_ADDRESS,
      scheme: "exact",
      network: EVM_NETWORK,
      price: "$0.001",  // Shorthand → USDC via EIP-3009
    },
    description: "Protected endpoint",
  },
  // Add Permit2 endpoint here:
  "GET /protected-permit2": {
    accepts: {
      payTo: EVM_PAYEE_ADDRESS,
      scheme: "exact",
      network: EVM_NETWORK,
      price: {
        amount: "1000000000000000",  // 0.001 WETH
        asset: "0x4200000000000000000000000000000000000006",
        extra: { assetTransferMethod: "permit2" },  // Uses settlement contract
      },
    },
    description: "Permit2 endpoint (WETH)",
  },
}, server));
```

## Key SDK Code Locations

### Server-Side parsePrice

**File**: `typescript/packages/mechanisms/evm/src/exact/server/scheme.ts`

```typescript
// Lines 77-103: parsePrice implementation
async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
  // If already an AssetAmount, return it directly
  if (typeof price === "object" && price !== null && "amount" in price) {
    return { amount: price.amount, asset: price.asset, extra: price.extra || {} };
  }
  // Parse Money to decimal, try custom parsers, fallback to USDC
  // ...
}
```

**Key insight**: Explicit `AssetAmount` bypasses all money parsing - use this for Permit2.

### Client-Side createPaymentPayload

**File**: `typescript/packages/mechanisms/evm/src/exact/client/scheme.ts`

Detects `extra.assetTransferMethod` and creates appropriate EIP-712 signature.

### Facilitator-Side settle

**File**: `typescript/packages/mechanisms/evm/src/exact/facilitator/scheme.ts`

Dispatches to either EIP-3009 or Permit2 based on `extra.assetTransferMethod`.

## Local Development

**CRITICAL**: Never install x402 packages from npm - they are V1.

| Location | Protocol | Example |
|----------|----------|---------|
| Inside monorepo | `workspace:*` | `"@x402/core": "workspace:*"` |
| Outside monorepo | `file:` | `"@x402/core": "file:../typescript/packages/core"` |

## Test Network Setup

**Networks**: Base Sepolia (`eip155:84532`) AND Ethereum Sepolia (`eip155:11155111`)

### WETH Addresses (18 decimals)

| Network | WETH Address |
|---------|--------------|
| Base Sepolia | `0x4200000000000000000000000000000000000006` |
| Ethereum Sepolia | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` |

### Permit2 Address (same on all networks)

`0x000000000022D473030F116dDEE9F6B43aC78BA3`

### Prerequisites for CLIENT Account

The CLIENT account needs WETH balance and Permit2 approval on BOTH networks:

```bash
# === Base Sepolia ===
# 1. Wrap ETH to WETH
cast send 0x4200000000000000000000000000000000000006 --value 0.01ether \
  --rpc-url https://sepolia.base.org --private-key $CLIENT_EVM_PRIVATE_KEY

# 2. Approve Permit2 for WETH
cast send 0x4200000000000000000000000000000000000006 \
  "approve(address,uint256)" \
  0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url https://sepolia.base.org --private-key $CLIENT_EVM_PRIVATE_KEY

# === Ethereum Sepolia ===
# 1. Wrap ETH to WETH
cast send 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 --value 0.01ether \
  --rpc-url https://rpc.sepolia.org --private-key $CLIENT_EVM_PRIVATE_KEY

# 2. Approve Permit2 for WETH
cast send 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 \
  "approve(address,uint256)" \
  0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url https://rpc.sepolia.org --private-key $CLIENT_EVM_PRIVATE_KEY
```

## V2 API Patterns

**CRITICAL**: Use V2 registration patterns.

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

## Foundry Toolchain

| Tool | Purpose |
|------|---------|
| `forge` | Compile, test, deploy contracts |
| `anvil` | Local Ethereum node |
| `cast` | CLI for contract interaction |

### Install

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Common Commands

```bash
cast balance $ADDR --rpc-url $RPC
cast call $ADDR "balanceOf(address)" $USER --rpc-url $RPC
cast send $ADDR "approve(address,uint256)" $SPENDER $AMT --rpc-url $RPC --private-key $KEY
```

## Commit Style

```
feat(e2e): add permit2 endpoint to test framework

- Add /protected-permit2 endpoint with WETH
- Update test.config.json with new endpoint
- Document prerequisites for CLIENT account
```

**IMPORTANT**: Do NOT include Claude advertisements, "Generated with Claude Code" links, or Co-Authored-By lines in commit messages. Keep commits clean and professional.

Sign commits: `git commit -s -m "..."`

## Constraints

1. **Follow existing patterns exactly** - Do not redesign e2e framework
2. **EVM only** - Skip SVM for this effort
3. **Use explicit AssetAmount** - Not `"$0.001"` shorthand for Permit2

## Running E2E Tests

```bash
# Run ONLY the Permit2 test (once endpoint is added)
cd /Users/fox/Getting\ Started/x402/e2e && \
  pnpm test --facilitators=typescript --servers=express --clients=fetch --families=evm

# Filter to specific endpoint (if supported)
# The test framework discovers endpoints from test.config.json
```

See `.claude/SUMMARY-E2E-ENV-SETUP.md` for full environment setup and troubleshooting.

### Mise Shell Workaround

**IMPORTANT**: If you encounter `permission denied` errors when running commands with environment variables, this is caused by `mise` (tool version manager) hooks in non-interactive shells.

**Symptom**:
```
env: /Users/fox/.local/share/mise/installs/node/22.21.0/bin/node: Permission denied
```

**Solution**: Wrap commands in `/bin/bash -c '...'` to bypass mise hooks:

```bash
# Instead of:
BASE_SEPOLIA_RPC_URL=http://localhost:8545 ./node_modules/.bin/tsx test.ts

# Use:
/bin/bash -c 'cd "/Users/fox/Getting Started/x402/e2e" && BASE_SEPOLIA_RPC_URL=http://localhost:8545 X402_SETTLEMENT_ADDRESS=0x... ./node_modules/.bin/tsx test.ts --facilitators=typescript --servers=express --clients=fetch --families=evm'
```

This bypasses the mise shim layer and runs commands directly.

## References

- `.claude/SUMMARY-E2E-ENV-SETUP.md` - E2E environment configuration
- `.claude/SUMMARY-HTTP-CAPTURE.md` - HTTP header capture technique
- `.claude/SUMMARY-PAYMENT-REQUIRED.md` - Payment header schema and client selection
- [Uniswap Permit2 Docs](https://docs.uniswap.org/contracts/permit2/overview)
- `demo/permit2/README.md` - Demo documentation
- `docs/03-sdk-reference/mechanisms/evm-permit2.md` - SDK docs

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

