# E2E Environment Configuration System

## Overview

Implemented a network-aware environment variable resolution system that allows switching between multiple EVM networks (Base Sepolia, Radius Testnet, etc.) by changing only a single variable.

**Key Benefit**: Switch networks by modifying only `EVM_NETWORK` in `.env`, eliminating manual configuration of multiple interdependent variables.

## Architecture

### Configuration Helper (`e2e/src/config.ts`)

Centralized configuration resolution module that:
1. Extracts numeric chain ID from `EVM_NETWORK` (e.g., `eip155:84532` → `84532`)
2. Looks for network-specific variables with suffix pattern `${VAR_NAME}_${CHAIN_ID}`
3. Falls back to base variable names if network-specific variants don't exist
4. Caches resolved configuration for performance

**Resolution Order**:
```
1. Network-specific: ${KEY}_${CHAIN_ID}  (e.g., EVM_RPC_URL_1223953)
2. Base variable: ${KEY}                  (e.g., EVM_RPC_URL)
3. Error if neither exists
```

### Environment Structure

#### Base Sepolia (Default - eip155:84532)
```env
# No suffix - these are the defaults
CLIENT_EVM_PRIVATE_KEY=0x...
FACILITATOR_EVM_PRIVATE_KEY=0x...
SERVER_EVM_ADDRESS=0x...
EVM_RPC_URL=https://sepolia.base.org
PERMIT2_TOKEN_ADDRESS=0x4200000000000000000000000000000000000006
PERMIT2_TOKEN_DECIMALS=18
X402_SETTLEMENT_ADDRESS=0x2539c506ee3f5A08886d3c1EADc0307DF8096A1b
```

#### Radius Testnet (eip155:1223953)
```env
# Suffix with chain ID - overrides for specific network
CLIENT_EVM_PRIVATE_KEY_1223953=0x...
FACILITATOR_EVM_PRIVATE_KEY_1223953=0x...
SERVER_EVM_ADDRESS_1223953=0x...
EVM_RPC_URL_1223953=https://rpc.testnet.radiustech.xyz
PERMIT2_TOKEN_ADDRESS_1223953=0xF966020a30946A64B39E2e243049036367590858
PERMIT2_TOKEN_DECIMALS_1223953=18
X402_SETTLEMENT_ADDRESS_1223953=0x740C8fb1853F9ab61E405A30F3E9c9f41F4e65C6
```

## Usage

### Switching Networks

**Current Network**: Set `EVM_NETWORK` at top of `.env`:
```env
EVM_NETWORK=eip155:84532      # Base Sepolia (default)
# or
EVM_NETWORK=eip155:1223953    # Radius Testnet
```

**Add Network-Specific Values**: For each new network, provide suffixed environment variables:
```env
EVM_RPC_URL_1223953=...
PERMIT2_TOKEN_ADDRESS_1223953=...
X402_SETTLEMENT_ADDRESS_1223953=...
# etc.
```

No code changes needed - the config system automatically resolves values based on `EVM_NETWORK`.

### In Code

**Facilitator** (`e2e/facilitators/typescript/index.ts`):
```typescript
import { getConfig, logConfigSummary } from '../../src/config.js';

const cfg = getConfig();
logConfigSummary(); // Debug output

const evmAccount = privateKeyToAccount(cfg.facilitatorEVMPrivateKey);
const viemClient = createWalletClient({
  transport: http(cfg.evmRpcUrl),
});
```

**Server** (`e2e/servers/express/index.ts`):
```typescript
import { getConfig } from '../../src/config.js';

const cfg = getConfig();
const EVM_NETWORK = cfg.network;
const EVM_PAYEE_ADDRESS = cfg.serverEVMAddress;
const PERMIT2_TOKEN_ADDRESS = cfg.permit2TokenAddress;
```

## Test Results

### ✅ Base Sepolia (Default)
```
✓ Config loaded successfully
  Network: eip155:84532
  RPC URL: https://sepolia.base.org
  Token: 0x4200000000...
  Settlement: 0x2539c506...
```

### ✅ Radius Testnet (Network Override)
```
✓ Config loaded successfully
  Network: eip155:1223953
  RPC URL: https://rpc.testnet.radiustech.xyz
  Token: 0xF966020a...
  Settlement: 0x740C8fb1...
```

### ✅ Fallback to Base Values
When network-specific overrides are absent, system correctly falls back to base values:
```
EVM_NETWORK=eip155:1223953 (no _1223953 suffixed vars)
→ RPC URL falls back to: https://sepolia.base.org
→ Token falls back to: 0x4200000000...
→ Settlement falls back to: 0x2539c506...
```

## Files Modified

1. **Created**: `e2e/src/config.ts`
   - 240 lines of config resolution logic with comprehensive documentation

2. **Updated**: `e2e/.env`
   - Restructured to use network-specific suffix pattern
   - Added commented examples for Radius Testnet

3. **Created**: `e2e/.env.example`
   - 160+ lines of comprehensive documentation
   - Explains override system, network switching, prerequisites

4. **Updated**: `e2e/facilitators/typescript/index.ts`
   - Replaced hardcoded env var reads with `getConfig()`
   - Changed `EVM_PRIVATE_KEY` → `FACILITATOR_EVM_PRIVATE_KEY`
   - Added `logConfigSummary()` for debugging

5. **Updated**: `e2e/servers/express/index.ts`
   - Replaced hardcoded env var reads with `getConfig()`
   - Simplified environment variable validation

## Design Decisions

### ✓ Base Values Have No Suffix
- Keeps `.env` minimal and readable for the default network
- Reduces duplication for the most common case
- Code doesn't change when using default network

### ✓ Per-Network Private Keys
- Allows different test accounts per network
- Enables independent account funding/setup per network
- Provides maximum flexibility for multi-network testing

### ✓ Lazy-Loaded Configuration
- Ensures dotenv has time to load before env var resolution
- Prevents race conditions during module import
- Caches resolved config for performance

### ✓ Centralized Resolution Logic
- Single source of truth for how variables are resolved
- Easy to test and debug
- Reusable by all components (server, facilitator, tests)

## Adding New Networks

To add a new network (e.g., Ethereum Sepolia):

1. Add network-specific variables to `.env`:
   ```env
   CLIENT_EVM_PRIVATE_KEY_11155111=0x...
   FACILITATOR_EVM_PRIVATE_KEY_11155111=0x...
   SERVER_EVM_ADDRESS_11155111=0x...
   EVM_RPC_URL_11155111=https://rpc.sepolia.org
   PERMIT2_TOKEN_ADDRESS_11155111=0x...
   PERMIT2_TOKEN_DECIMALS_11155111=18
   X402_SETTLEMENT_ADDRESS_11155111=0x...
   ```

2. Set `EVM_NETWORK=eip155:11155111`

3. Run tests - no code changes needed!

## Future Enhancements

- Add validation for required environment variables per network
- Support environment variable defaults in `config.ts` as fallback
- Add `.env` schema validation
- Generate `.env.example` from config spec dynamically

## References

- CLAUDE.md: Comprehensive E2E testing guide and constraints
- .env.example: Complete documentation on usage and prerequisites
- src/config.ts: Implementation with inline documentation
