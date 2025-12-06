<!-- VERIFIED: 3c3e2168 -->
# Running Tests

Guide for executing x402 end-to-end tests.

## Overview

The E2E test suite validates client-server-facilitator communication across different languages and frameworks. Tests run actual payment flows against testnets.

## Prerequisites

### Environment Setup

1. Create a `.env` file in the `e2e/` directory:

```bash
# Client wallets
CLIENT_EVM_PRIVATE_KEY=0x...
CLIENT_SVM_PRIVATE_KEY=...

# Server payment addresses
SERVER_EVM_ADDRESS=0x...
SERVER_SVM_ADDRESS=...

# Facilitator wallets (for settlement)
FACILITATOR_EVM_PRIVATE_KEY=0x...
FACILITATOR_SVM_PRIVATE_KEY=...
```

2. Fund test wallets:
   - Client needs testnet USDC (Base Sepolia / Solana Devnet)
   - Facilitator needs testnet ETH/SOL for gas

### Installation

Install all dependencies:

```bash
cd e2e
pnpm install:all
```

This installs:
- TypeScript dependencies via pnpm
- Go dependencies
- Python dependencies

For individual setup:

```bash
# TypeScript only
pnpm install

# Specific component
cd facilitators/go
bash install.sh
bash build.sh
```

## Running Tests

### Interactive Mode

Launch the interactive test runner:

```bash
pnpm test
```

Select components to test:

1. **Facilitators** - Payment verification/settlement services
2. **Servers** - Protected endpoints (Express, Hono, etc.)
3. **Clients** - Payment-capable HTTP clients (fetch, axios, etc.)
4. **Extensions** - Protocol extensions (Bazaar)
5. **Protocols** - EVM and/or SVM networks

All valid combinations are tested automatically.

### Minimized Mode

Run with intelligent test minimization:

```bash
pnpm test --min
```

Benefits:
- 90% fewer tests than full mode
- Each component tested at least once
- Skips redundant combinations
- Faster iteration during development

### Verbose Mode

Enable detailed logging:

```bash
pnpm test -v
pnpm test --min -v
```

Shows:
- Facilitator logs
- Server logs
- Client logs
- Detailed test information

## Test Components

### Facilitators

| Name | Language | Description |
|------|----------|-------------|
| `typescript` | TypeScript | Reference facilitator |
| `go` | Go | Go implementation |

### Servers

| Name | Framework | Protocols |
|------|-----------|-----------|
| `express` | Express.js | EVM, SVM |
| `hono` | Hono | EVM, SVM |
| `next` | Next.js | EVM, SVM |
| `gin` | Go Gin | EVM, SVM |

### Clients

| Name | Language | Description |
|------|----------|-------------|
| `fetch` | TypeScript | Native fetch wrapper |
| `axios` | TypeScript | Axios interceptor |
| `go-http` | Go | Go HTTP client |

## Test Configuration

### Test Scenarios

Each test scenario includes:

1. Start facilitator
2. Start server
3. Run client request
4. Verify payment flow
5. Check settlement

### Example Session

```bash
$ pnpm test --min

🎯 Interactive Mode
==================

✔ Select facilitators › go, typescript
✔ Select servers › express, hono
✔ Select clients › axios, fetch
✔ Select extensions › bazaar
✔ Select protocol families › EVM, SVM

📊 Coverage-Based Minimization
Total scenarios: 64
Selected scenarios: 12 (81.3% reduction)

Running tests...

✅ Passed: 12
❌ Failed: 0
```

## Adding New Tests

### Adding a Server

1. Create directory under `e2e/servers/`:

```
e2e/servers/my-server/
├── install.sh
├── build.sh
├── index.ts (or main.go, app.py, etc.)
└── package.json (if TypeScript)
```

2. Implement required endpoints:
   - `GET /protected` - EVM payment required
   - `GET /protected-svm` - SVM payment required
   - `GET /health` - Health check
   - `POST /close` - Graceful shutdown

3. Register in test configuration

### Adding a Client

1. Create directory under `e2e/clients/`:

```
e2e/clients/my-client/
├── install.sh
├── build.sh
├── index.ts (or main.py, etc.)
└── package.json (if TypeScript)
```

2. Implement payment flow:
   - Accept `RESOURCE_SERVER_URL` and `ENDPOINT_PATH` env vars
   - Make request to protected endpoint
   - Output JSON result

3. Register in test configuration

## Troubleshooting

### Common Issues

**Test fails with "insufficient balance"**

Fund the test wallet with USDC:
```bash
# Check client balance
cast balance $CLIENT_ADDRESS --erc20 $USDC_ADDRESS --rpc-url $RPC_URL
```

**Test fails with "gas required exceeds allowance"**

Fund the facilitator wallet with ETH/SOL:
```bash
# Check facilitator balance
cast balance $FACILITATOR_ADDRESS --rpc-url $RPC_URL
```

**Server fails to start**

Check port availability:
```bash
lsof -i :4021
lsof -i :4022
```

**Client timeout**

Increase timeout in test configuration or check network connectivity.

### Debug Mode

Run individual components manually:

```bash
# Terminal 1: Start facilitator
cd e2e/facilitators/typescript
npm start

# Terminal 2: Start server
cd e2e/servers/express
FACILITATOR_URL=http://localhost:4022 npm start

# Terminal 3: Run client
cd e2e/clients/fetch
RESOURCE_SERVER_URL=http://localhost:4021 ENDPOINT_PATH=/protected npm start
```

### Logs Location

Test logs are written to:
- `e2e/logs/facilitator.log`
- `e2e/logs/server.log`
- `e2e/logs/client.log`

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: cd e2e && pnpm install:all

      - name: Run E2E tests
        env:
          CLIENT_EVM_PRIVATE_KEY: ${{ secrets.CLIENT_EVM_PRIVATE_KEY }}
          FACILITATOR_EVM_PRIVATE_KEY: ${{ secrets.FACILITATOR_EVM_PRIVATE_KEY }}
        run: cd e2e && pnpm test --min
```

### Test Selection in CI

Run specific combinations:

```bash
# Only TypeScript components
pnpm test --facilitators=typescript --servers=express --clients=fetch

# Only EVM protocol
pnpm test --protocols=evm
```

## Next Steps

- [Environment Setup](./environment-setup.md) - Configure test environment
- [Production](./production.md) - Production deployment
