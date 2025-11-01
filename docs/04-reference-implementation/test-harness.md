# Test Harness

Architecture of the e2e test system that validates client/server implementations.

## Overview

**Location**: `e2e/src/`
**Main File**: `e2e/test.ts`

## Components

### Test Discovery (`discovery.ts`)

Automatically finds clients and servers by scanning for `test.config.json` files.

### Proxy System

- `BaseProxy` - Process management base class
- `GenericClientProxy` - Wraps client execution
- `GenericServerProxy` - Manages server lifecycle

### Test Execution

Generates test scenarios by combining:
- Clients
- Servers  
- Endpoints
- Networks
- Facilitator configs

## Running Tests

```bash
# All tests
pnpm test

# Development mode (testnet)
pnpm test -d

# Specific implementations
pnpm test -d --client=fetch --server=express
```

---

*Reference: `e2e/src/` and [E2E README](../../../e2e/README.md)*
