# x402 PAYMENT-REQUIRED Header Summary

This document summarizes the `payment-required` HTTP header structure, schema differences between V1 and V2, multi-accepts patterns, and client selection logic.

## Overview

When a server requires payment, it returns HTTP 402 with a `payment-required` header containing base64-encoded JSON. The `accepts` array can contain **multiple payment options**, allowing clients flexibility in how they pay.

## Schema Comparison: V1 vs V2

### V1 Schema (npm packages, official spec)

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "1000",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      "resource": "https://api.example.com/premium-data",
      "description": "Access to premium market data",
      "mimeType": "application/json",
      "outputSchema": null,
      "maxTimeoutSeconds": 60,
      "extra": { "name": "USDC", "version": "2" }
    }
  ]
}
```

### V2 Schema (local SDK, unreleased)

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://localhost:4030/protected",
    "description": "",
    "mimeType": ""
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "amount": "1000",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "payTo": "0x159a4296b5db749b4af31a2a6beaf37efa2a0204",
      "maxTimeoutSeconds": 300,
      "extra": { "name": "USDC", "version": "2" }
    }
  ],
  "extensions": {
    "bazaar": { ... }
  }
}
```

### Key Differences

| Field | V1 | V2 |
|-------|----|----|
| Amount field | `maxAmountRequired` | `amount` |
| Network format | `"base-sepolia"` | `"eip155:84532"` (CAIP-2) |
| Resource location | Inside each `accepts[]` item | Top-level `resource` object |
| Extensions | Not present | `extensions` object at top level |
| outputSchema | Present | Removed |

## Multi-Accepts Examples

### TypeScript Server (V1)
**File**: `examples/typescript/servers/advanced/index.ts`

```typescript
app.get("/multiple-payment-requirements", async (req, res) => {
  const paymentRequirements = [
    createExactPaymentRequirements("$0.001", "base", resource),           // Base mainnet
    createExactPaymentRequirements(
      { amount: "1000", asset: { address: "0x036CbD...", decimals: 6, eip712: {...} } },
      "base-sepolia",                                                      // Base Sepolia
      resource,
    ),
  ];
  // ...
});
```

### Python Server (V1)
**File**: `examples/python/servers/advanced/main.py`

```python
payment_requirements = [
    create_exact_payment_requirements(price="$0.001", network="base", resource=resource),
    create_exact_payment_requirements(
        price=TokenAmount(amount="1000", asset=TokenAsset(address="0x036CbD...", ...)),
        network="base-sepolia",
        resource=resource,
    ),
]
```

### Go Server (mcp-go-x402)

```go
srv.AddPayableTool(
    mcp.NewTool("analytics", ...),
    analyticsHandler,
    x402server.RequireUSDCBase("0xWallet", "50000", "Base - 0.05 USDC"),
    x402server.RequireUSDCPolygon("0xWallet", "75000", "Polygon - 0.075 USDC"),
    x402server.RequireUSDCBaseSepolia("0xWallet", "10000", "Base Sepolia - 0.01 USDC"),
)
```

### V2 Multi-Accepts (Interpolated)

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://localhost:4021/multiple-payment-requirements",
    "description": "Access to weather data",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "amount": "1000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x159a4296b5db749b4af31a2a6beaf37efa2a0204",
      "maxTimeoutSeconds": 60,
      "extra": { "name": "USDC", "version": "2" }
    },
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "amount": "1000",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "payTo": "0x159a4296b5db749b4af31a2a6beaf37efa2a0204",
      "maxTimeoutSeconds": 60,
      "extra": { "name": "USDC", "version": "2" }
    },
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "amount": "1000000000000000",
      "asset": "0x4200000000000000000000000000000000000006",
      "payTo": "0x159a4296b5db749b4af31a2a6beaf37efa2a0204",
      "maxTimeoutSeconds": 60,
      "extra": { "name": "WETH", "version": "1", "assetTransferMethod": "permit2" }
    }
  ],
  "extensions": { "bazaar": { ... } }
}
```

## Client Selection Logic

**The CLIENT chooses** from the server's `accepts` array. The server only offers options.

### TypeScript Client (Simple)
**File**: `packages/x402/src/client/selectPaymentRequirements.ts`

**Algorithm**:
1. Filter to client's supported networks (if specified)
2. Prefer USDC over other tokens
3. Return first matching USDC, or first match if no USDC

```typescript
function selectPaymentRequirements(
  paymentRequirements: PaymentRequirements[],
  network?: Network | Network[]
): PaymentRequirements {
  // 1. Filter by network if specified
  const broadlyAccepted = paymentRequirements.filter(req =>
    !network || (Array.isArray(network) ? network.includes(req.network) : network == req.network)
  );

  // 2. Find USDC requirements
  const usdcRequirements = broadlyAccepted.filter(req =>
    req.asset === getUsdcChainConfigForChain(getNetworkId(req.network))?.usdcAddress
  );

  // 3. Return first USDC, or first match, or first overall
  if (usdcRequirements.length > 0) return usdcRequirements[0];
  if (broadlyAccepted.length > 0) return broadlyAccepted[0];
  return paymentRequirements[0];
}
```

### Go Client (Advanced)
**File**: `mcp-go-x402/handler.go`

**Algorithm**:
1. Filter to client's configured payment options (network + asset combos)
2. Check scheme matches
3. Check amount is within client's `MaxAmount` limit
4. Sort by client-configured priority (lower = better)
5. Among equal priority, sort by cheapest amount

```go
func (h *PaymentHandler) selectPaymentMethodForSigner(signer PaymentSigner, accepts []PaymentRequirement) (*PaymentRequirement, error) {
    var candidates []candidate

    for _, req := range accepts {
        option := signer.GetPaymentOption(req.Network, req.Asset)
        if option == nil { continue }  // Client doesn't support this network/asset
        if option.Scheme != req.Scheme { continue }

        amount := new(big.Int)
        amount.SetString(req.MaxAmountRequired, 10)

        // Check client's max amount limit
        if option.MaxAmount != "" {
            maxAmount := new(big.Int)
            maxAmount.SetString(option.MaxAmount, 10)
            if amount.Cmp(maxAmount) > 0 { continue }  // Exceeds client limit
        }

        candidates = append(candidates, candidate{req, option.Priority, amount})
    }

    // Sort: priority first, then cheapest
    sort.Slice(candidates, func(i, j int) bool {
        if candidates[i].priority != candidates[j].priority {
            return candidates[i].priority < candidates[j].priority
        }
        return candidates[i].amount.Cmp(candidates[j].amount) < 0
    })

    return &candidates[0].req, nil
}
```

### Go Client Configuration Example

```go
signer, _ := x402.NewPrivateKeySigner(privateKey,
    x402.AcceptUSDCBase().
        WithPriority(1).           // Prefer Base (cheap gas)
        WithMaxAmount("1000000").  // Max 1 USDC per payment
        WithMinBalance("500000"),  // Keep 0.5 USDC reserve

    x402.AcceptUSDCBaseSepolia().
        WithPriority(2).           // Fallback to testnet
        WithMaxAmount("100000"),   // Max 0.1 USDC on testnet
)
```

## Selection Example

Given server offers:
```
Option 1: Base mainnet USDC, 1000 units
Option 2: Base Sepolia USDC, 1000 units
Option 3: Base Sepolia WETH (Permit2), 0.001 ETH
```

| Client Config | Selected | Reason |
|---------------|----------|--------|
| TypeScript, no filter | Option 1 | First USDC match |
| TypeScript, filter=`base-sepolia` | Option 2 | First USDC in filtered set |
| Go, Base priority=1, Sepolia priority=2 | Option 1 | Lower priority wins |
| Go, Base maxAmount=500 (too low) | Option 2 | Option 1 exceeds limit |
| Go, no WETH configured | Option 1 or 2 | Option 3 not supported |

## Server vs Client Control

| Aspect | Server | Client |
|--------|--------|--------|
| Role | Offers acceptable payment methods | Chooses which to use |
| Prioritization | Array order is suggestive only | Client's priority config wins |
| Constraints | Sets price, network, asset, timeout | Sets max amount, min balance, network preference |
| Control | None over client choice | Full control within offered options |

The server cannot force the client to use a specific option. It can only:
1. Offer options it's willing to accept
2. Reject payments that don't match any offered option

## Common Multi-Accepts Patterns

1. **Mainnet + Testnet Fallback**: Production network (higher cost) + testnet (discounted, for development)
2. **Multi-Chain Support**: Base, Polygon, Avalanche with different pricing per network
3. **Different Assets**: USDC vs WETH vs other ERC-20s
4. **Different Transfer Methods**: EIP-3009 (native USDC) vs Permit2 (any ERC-20)

## References

- Official spec: `specs/x402-specification.md`
- TypeScript types (V1): `typescript/packages/x402/src/types/verify/x402Specs.ts`
- TypeScript types (V2): `typescript/packages/core/src/types/payments.ts`
- Go types: `mcp-go-x402/types.go`
- Advanced server examples: `examples/typescript/servers/advanced/index.ts`, `examples/python/servers/advanced/main.py`
- Client selection: `typescript/packages/x402/src/client/selectPaymentRequirements.ts`, `mcp-go-x402/handler.go`
