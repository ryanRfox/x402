# x402 E2E Test Environment Setup

This document covers how to properly configure the e2e test environment for running x402 tests.

## Quick Start Command

```bash
cd /Users/fox/Getting\ Started/x402/e2e && \
  pnpm test --facilitators=typescript --servers=express --clients=fetch --families=evm
```

## Required Environment Variables

The e2e framework runs **LOCAL facilitators**, not external ones. All 6 environment variables are required in `/e2e/.env`:

```bash
# E2E Test Environment Configuration
# Base Sepolia testnet

# Server addresses (where payments will be sent)
# NOTE: This should be DIFFERENT from your client address in production
SERVER_EVM_ADDRESS=0x159a4296b5db749b4af31a2a6beaf37efa2a0204
SERVER_SVM_ADDRESS=DummySolanaAddressNotUsedForEVMTests11111111111

# Client private keys (accounts that will make payments)
# MUST have 0x prefix for EVM keys
CLIENT_EVM_PRIVATE_KEY=0x148d11da374c17c691e9786edb9d003178fa9ae0438b30649de9b5f86f963634
CLIENT_SVM_PRIVATE_KEY=5RXwRKMW39BhZbinsp9FtPAG2KNQKBh18prv6smpXPXGLNTktXEHYC6NcZ9hJsauq5Qh5eimJR5gdKvDJ8bDmBS7

# Facilitator private keys (accounts that settle payments on-chain)
# The facilitator needs ETH for gas to execute settlements
# Can use SAME key as client for testing, or a different funded account
FACILITATOR_EVM_PRIVATE_KEY=0x148d11da374c17c691e9786edb9d003178fa9ae0438b30649de9b5f86f963634
FACILITATOR_SVM_PRIVATE_KEY=5RXwRKMW39BhZbinsp9FtPAG2KNQKBh18prv6smpXPXGLNTktXEHYC6NcZ9hJsauq5Qh5eimJR5gdKvDJ8bDmBS7

# Networks
EVM_NETWORK=eip155:84532
SVM_NETWORK=solana-devnet
```

## Common Setup Errors & Fixes

### Error: "Missing required environment variables"

**Cause**: Missing `FACILITATOR_EVM_PRIVATE_KEY` and/or `FACILITATOR_SVM_PRIVATE_KEY`

**Fix**: Add both facilitator keys. The e2e framework runs LOCAL facilitators, not external ones like the public Coinbase facilitator.

### Error: "Invalid Solana private key"

**Cause**: The SVM private key must be a valid base58-encoded ed25519 keypair (64 bytes: 32 seed + 32 pubkey), even for EVM-only tests.

**Fix**: Generate a valid Solana keypair:

```javascript
// Node.js one-liner to generate valid Solana keypair
const { randomBytes } = require('crypto');
const bs58 = require('bs58');
const seed = randomBytes(32);
const nacl = require('tweetnacl');
const keypair = nacl.sign.keyPair.fromSeed(seed);
console.log(bs58.encode(Buffer.from(keypair.secretKey)));
```

Or use an existing valid keypair like:
```
5RXwRKMW39BhZbinsp9FtPAG2KNQKBh18prv6smpXPXGLNTktXEHYC6NcZ9hJsauq5Qh5eimJR5gdKvDJ8bDmBS7
```

### Error: "Invalid private key" (viem)

**Cause**: EVM private keys missing `0x` prefix

**Fix**: Ensure all EVM private keys start with `0x`:
```bash
CLIENT_EVM_PRIVATE_KEY=0x148d11da...  # Good
CLIENT_EVM_PRIVATE_KEY=148d11da...    # Bad - missing 0x
```

### Error: "@x402/extensions not found" or build errors

**Cause**: SDK packages not built

**Fix**: Build the TypeScript SDK first:
```bash
cd /Users/fox/Getting\ Started/x402/typescript && pnpm build
```

### Error: "Port 4022/4023 already in use"

**Cause**: Stale processes from previous test runs

**Fix**: Kill processes on those ports:
```bash
lsof -ti:4022 | xargs kill -9
lsof -ti:4023 | xargs kill -9
```

## Test Filtering Options

```bash
# Run specific facilitator
pnpm test --facilitators=typescript

# Run specific server
pnpm test --servers=express

# Run specific client
pnpm test --clients=fetch

# Run specific protocol family (evm or svm)
pnpm test --families=evm

# Combine filters
pnpm test --facilitators=typescript --servers=express --clients=fetch --families=evm
```

## Available Components

### Facilitators
- `typescript` - TypeScript facilitator (V2)
- `go` - Go facilitator (V2)

### Servers
- `express` - Express.js server (V2)
- `gin` - Go Gin server (V2)
- `hono` - Hono server (V2)
- `next` - Next.js server (V2)
- `legacy-*` - V1 implementations

### Clients
- `fetch` - Fetch client (V2)
- `axios` - Axios client (V2)
- `go-http` - Go HTTP client (V2)
- `legacy-*` - V1 implementations

## Test Architecture

```
┌─────────┐     ┌─────────┐     ┌─────────────┐
│ Client  │────▶│ Server  │────▶│ Facilitator │
│ (fetch) │     │(express)│     │ (typescript)│
└─────────┘     └─────────┘     └─────────────┘
    │               │                  │
    │   HTTP 402    │                  │
    │◀──────────────│                  │
    │               │                  │
    │ Payment sig   │    /verify       │
    │──────────────▶│─────────────────▶│
    │               │                  │
    │               │    /settle       │
    │               │─────────────────▶│
    │               │                  │
    │   HTTP 200    │                  │
    │◀──────────────│                  │
```

## Ports Used

| Component | Port |
|-----------|------|
| Server (express, etc.) | 4022 |
| Facilitator | 4023 |
| Proxy (if used) | 4030 |

## Verifying Test Account Setup

```bash
# Check client account has USDC on Base Sepolia
cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "balanceOf(address)" \
  $(cast wallet address --private-key $CLIENT_EVM_PRIVATE_KEY) \
  --rpc-url https://sepolia.base.org

# Check facilitator account has ETH for gas
cast balance \
  $(cast wallet address --private-key $FACILITATOR_EVM_PRIVATE_KEY) \
  --rpc-url https://sepolia.base.org
```

## Notes

- The e2e framework generates scenarios as: `Client × Server × Endpoint × Facilitator × ProtocolFamily`
- Test results show transaction hashes that can be verified on Base Sepolia explorer
- The framework uses EIP-3009 (`transferWithAuthorization`) for USDC payments by default
- For Permit2 testing, see `CLAUDE.md` for endpoint configuration
