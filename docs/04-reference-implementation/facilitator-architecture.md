# Facilitator Architecture

Architecture of the local facilitator implementation used in the reference server.

## Overview

**Location**: `e2e/servers/express/facilitator.ts`
**Packages**: `@x402/core/facilitator` and `@x402/evm`

## Purpose

The facilitator is responsible for:
- Verifying payment signatures
- Settling transactions on the blockchain
- Supporting multiple payment schemes

## Implementation

See `e2e/servers/express/facilitator.ts` for complete implementation.

### Key Classes

- `x402Facilitator` - Multi-scheme facilitator coordinator
- `ExactEvmFacilitator` - EVM exact scheme implementation
- `LocalFacilitatorClient` - FacilitatorClient wrapper

## Operations

### Verify Payment

Checks signature validity, amount, expiration, and balance.

### Settle Payment

Executes on-chain `transferWithAuthorization` transaction.

---

*Reference: `e2e/servers/express/facilitator.ts` and `typescript/packages/mechanisms/evm/src/exact/index.ts`*
