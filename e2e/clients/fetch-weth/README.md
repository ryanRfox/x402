# E2E Test Client: TypeScript Fetch (WETH/Permit2)

This client demonstrates and tests the `@x402/fetch` package with a WETH/Permit2 preference policy, selecting WETH payment options when available from multi-mechanism endpoints.

## What It Tests

### Core Functionality
- ✅ **V2 Protocol** - Modern x402 protocol with CAIP-2 networks
- ✅ **V1 Protocol** - Legacy x402 protocol with simple network names
- ✅ **Multi-chain Support** - Both EVM and SVM in a single client
- ✅ **Payment Policy** - Custom policy to prefer WETH/Permit2 payment options
- ✅ **Automatic Payment Handling** - Transparent 402 response handling
- ✅ **Payment Response Decoding** - Extracts settlement information from headers

### Payment Mechanisms
- ✅ **EVM V2 (WETH/Permit2)** - Prefers WETH payment via Permit2 when available
- ✅ **EVM V2 (USDC/EIP-3009)** - Falls back to USDC when WETH not offered
- ✅ **SVM V2** - `solana:*` wildcard scheme

## What It Demonstrates

### Usage Pattern

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, PaymentPolicy } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";

const WETH_ASSET = "0x4200000000000000000000000000000000000006";

// Policy: prefer WETH payment options when available
const preferWeth: PaymentPolicy = (_version, requirements) => {
  const wethOptions = requirements.filter(
    r => r.asset.toLowerCase() === WETH_ASSET.toLowerCase(),
  );
  return wethOptions.length > 0 ? wethOptions : requirements;
};

// Create client with WETH preference policy
const client = new x402Client();
registerExactEvmScheme(client, { signer: evmAccount, policies: [preferWeth] });
registerExactSvmScheme(client, { signer: svmSigner });

// Wrap fetch with payment handling
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Make request - 402 responses handled automatically, WETH preferred
const response = await fetchWithPayment(url, { method: "GET" });
```

### Key Concepts Shown

1. **Payment Policies** - Custom policy filters payment options by asset
2. **Permit2 Flow** - WETH uses Permit2 (not EIP-3009) for token transfers
3. **Multi-Mechanism Negotiation** - Client selects from multiple payment options
4. **Fallback Behavior** - Falls back to all options when WETH not available
5. **Transparent Payment** - No manual 402 handling needed

## Test Scenarios

This client is tested against:
- **Servers:** Express (TypeScript)
- **Facilitators:** TypeScript
- **Endpoints:** `/protected` (multi-mechanism: USDC/EIP-3009, WETH/Permit2, SVM)
- **Networks:** Base Sepolia (EVM), Solana Devnet (SVM)

### Success Criteria
- ✅ Request succeeds with 200 status
- ✅ Payment response header present
- ✅ Transaction hash returned
- ✅ Payment marked as successful
- ✅ WETH/Permit2 selected when multi-mechanism endpoint offers it

## Running

```bash
# Via e2e test suite
cd e2e
pnpm test --client=fetch-weth

# Direct execution (requires environment variables)
cd e2e/clients/fetch-weth
export RESOURCE_SERVER_URL="http://localhost:4022"
export ENDPOINT_PATH="/protected"
export EVM_PRIVATE_KEY="0x..."
export SVM_PRIVATE_KEY="..."
pnpm start
```

## Environment Variables

- `RESOURCE_SERVER_URL` - Server base URL
- `ENDPOINT_PATH` - Path to protected endpoint
- `EVM_PRIVATE_KEY` - Ethereum private key (hex with 0x prefix)
- `SVM_PRIVATE_KEY` - Solana private key (base58 encoded)

## Output Format

```json
{
  "success": true,
  "data": { "message": "Multi-mechanism endpoint accessed successfully" },
  "status_code": 200,
  "payment_response": {
    "success": true,
    "transaction": "0x...",
    "network": "eip155:84532",
    "payer": "0x..."
  }
}
```

## Package Dependencies

- `@x402/fetch` - HTTP wrapper with payment handling
- `@x402/core` - Core x402 client and types
- `@x402/evm` - EVM payment mechanisms (V2)
- `@x402/svm` - SVM payment mechanisms (V2)
- `viem` - Ethereum library for account creation
- `@solana/kit` - Solana keypair utilities
