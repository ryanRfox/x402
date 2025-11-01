# Running Tests

Guide to running the e2e test suite.

## Basic Usage

```bash
cd e2e

# All tests
pnpm test

# Development mode (testnet)
pnpm test -d

# Verbose logging
pnpm test -d -v
```

## Filtering Tests

### By Language

```bash
pnpm test -d -ts              # TypeScript only
pnpm test -d -py              # Python only
pnpm test -d -go              # Go only
pnpm test -ts -py             # TypeScript and Python
```

### By Implementation

```bash
pnpm test -d --client=fetch   # Specific client
pnpm test -d --server=express # Specific server
```

### By Network

```bash
pnpm test --network=base-sepolia
pnpm test --network=base
```

## Test Output

```
🚀 Starting X402 E2E Test Suite
===============================
🔍 Test Discovery Summary
========================
📡 Servers found: 1
   - express (typescript) v2 - 1 x402 endpoints [evm]
📱 Clients found: 1
   - fetch (typescript) v[2] [evm]
🔧 Facilitator/Network combos: 1
📊 Test scenarios: 1
   - EVM: 1 scenarios

Scenarios to run: 1

🧪 Testing #1: fetch → express → /protected [useCdpFacilitator=false, networks=[eip155:84532]]
✅ Passed: 1
❌ Failed: 0
📈 Total: 1
```

---

*See [E2E README](../../../e2e/README.md) for complete test documentation*
