# Prompt: Add Permit2 Support to E2E Test Framework

## Objective

Extend the existing e2e test framework to test the `exact` scheme with `assetTransferMethod: "permit2"` for arbitrary ERC-20 tokens.

**Scope**: EVM only (not SVM). This is intentional to reduce complexity.

## Background

The x402 SDK already supports Permit2 via the `exact` scheme when `extra.assetTransferMethod: "permit2"` is specified. The demo at `demo/permit2/` validates the Permit2 flow works correctly.

Now we need to integrate this into the main e2e test framework at `/e2e` to ensure the full HTTP 402 payment flow works with Permit2.

## What Already Works

1. **SDK Support**: The `exact` scheme handles both EIP-3009 (default) and Permit2 based on `extra.assetTransferMethod`
2. **Demo Tests**: `demo/permit2/test-sdk-*.ts` scripts validate Permit2 signatures and settlement
3. **E2E Framework**: Existing tests at `/e2e` validate the full 402 flow with USDC/EIP-3009

## What Needs to Be Done

### 1. Add Permit2 Endpoint to Express Server

**File**: `e2e/servers/express/index.ts`

Add a new endpoint that uses Permit2 instead of EIP-3009:

```typescript
"GET /protected-permit2": {
  accepts: {
    payTo: EVM_PAYEE_ADDRESS,
    scheme: "exact",
    network: EVM_NETWORK,
    price: {
      amount: "1000000000000000",  // 0.001 WETH (18 decimals)
      asset: "0x4200000000000000000000000000000000000006",  // WETH on Base Sepolia
      extra: { assetTransferMethod: "permit2" },
    },
  },
  description: "Permit2 protected endpoint",
}
```

**Key insight**: Use explicit `AssetAmount` (not `"$0.001"` shorthand) to specify the token and transfer method directly.

### 2. Update test.config.json

**File**: `e2e/servers/express/test.config.json`

Add the new endpoint to the test configuration:

```json
{
  "endpoints": [
    // ... existing endpoints ...
    {
      "path": "/protected-permit2",
      "method": "GET",
      "description": "Permit2 protected endpoint (WETH)",
      "requiresPayment": true,
      "protocolFamily": "evm",
      "networks": ["eip155:84532"]
    }
  ]
}
```

### 3. Environment Variables

The e2e framework uses separate keys for each role:
- `CLIENT_EVM_PRIVATE_KEY` - Signs payment payloads
- `FACILITATOR_EVM_PRIVATE_KEY` - Executes settlement transactions
- `SERVER_EVM_ADDRESS` - Receives payment (derived from private key)

For Permit2 testing, the CLIENT must have:
1. WETH balance on the test network
2. Permit2 approval for WETH

### 4. Test Network Setup

**Recommended**: Base Sepolia with WETH at `0x4200000000000000000000000000000000000006`

Prerequisites for the CLIENT account:
```bash
# 1. Get test ETH from faucet
# 2. Wrap ETH to WETH
cast send 0x4200000000000000000000000000000000000006 --value 0.01ether \
  --rpc-url https://sepolia.base.org --private-key $CLIENT_EVM_PRIVATE_KEY

# 3. Approve Permit2 for WETH
cast send 0x4200000000000000000000000000000000000006 \
  "approve(address,uint256)" \
  0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url https://sepolia.base.org --private-key $CLIENT_EVM_PRIVATE_KEY
```

## Technical Details

### Asset Transfer Methods

| Method | Field Value | Token Support | Default |
|--------|-------------|---------------|---------|
| EIP-3009 | `"eip3009"` or omitted | USDC only | Yes |
| Permit2 | `"permit2"` | Any ERC-20 | No |

### Key Files to Study

```
# E2E Framework
e2e/test.ts                          # Main orchestration
e2e/src/types.ts                     # TestEndpoint schema
e2e/src/discovery.ts                 # Scenario generation
e2e/servers/express/index.ts         # Server endpoints
e2e/clients/fetch/index.ts           # Fetch client
e2e/facilitators/typescript/index.ts # TS facilitator

# SDK Implementation
typescript/packages/mechanisms/evm/src/exact/server/scheme.ts    # parsePrice, AssetAmount
typescript/packages/mechanisms/evm/src/exact/client/scheme.ts    # createPaymentPayload
typescript/packages/mechanisms/evm/src/exact/facilitator/scheme.ts # verify, settle
typescript/packages/mechanisms/evm/src/permit2/constants.ts      # PERMIT2_ADDRESS
```

### Payment Flow

1. Client requests `GET /protected-permit2`
2. Server returns 402 with PaymentRequirements including `extra.assetTransferMethod: "permit2"`
3. Client SDK detects Permit2, signs EIP-712 `PermitTransferFrom` message
4. Client retries request with X-PAYMENT header
5. Server sends payload to Facilitator for verification
6. Facilitator validates signature off-chain
7. Server does work, responds to client
8. Facilitator settles by calling Permit2 contract
9. WETH transfers from Client to Server's `payTo` address

## Constraints

1. **Follow existing patterns exactly** - Do not redesign the e2e framework
2. **EVM only** - Skip SVM for this effort
3. **Use explicit AssetAmount** - Not `"$0.001"` shorthand for Permit2 endpoints
4. **Real network or Anvil fork** - Permit2 must be deployed

## Success Criteria

1. `npm test` in `/e2e` runs Permit2 scenario alongside existing EIP-3009 scenarios
2. Test verifies WETH transfers from CLIENT to SERVER address
3. No changes to existing EIP-3009 test behavior

## References

- [Uniswap Permit2 Docs](https://docs.uniswap.org/contracts/permit2/overview)
- [Circle CPN Permit2 Blog](https://www.circle.com/blog/how-cpn-uses-permit2-to-simplify-and-secure-onchain-payments)
- `demo/permit2/README.md` - Local demo documentation
- `docs/03-sdk-reference/mechanisms/evm-permit2.md` - SDK documentation
