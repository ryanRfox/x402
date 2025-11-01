# Network Variations

The x402 protocol v2 supports multiple blockchain networks through a scheme-based architecture.

## Supported Networks

### EVM Networks (Ethereum Virtual Machine)

**Format**: `eip155:<chainId>`

**Supported Networks**:
- `eip155:8453` - Base Mainnet
- `eip155:84532` - Base Sepolia (testnet)
- `eip155:1` - Ethereum Mainnet
- `eip155:11155111` - Ethereum Sepolia (testnet)

**Payment Scheme**: `exact` (EIP-3009 transferWithAuthorization)

**Token**: USDC (ERC-20 with EIP-3009 extension)

### SVM Networks (Solana Virtual Machine)

**Format**: `solana:<network>`

**Supported Networks**:
- `solana:mainnet` - Solana Mainnet
- `solana:devnet` - Solana Devnet (testnet)

**Payment Scheme**: `exact` (Solana-specific)

**Token**: USDC (SPL Token)

## EVM Implementation Details

### Asset Information

```typescript
// From ExactEvmService
private getDefaultAsset(network: Network): { address: string; name: string; version: string } {
  const usdcInfo = {
    "eip155:8453": {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      name: "USD Coin",
      version: "2"
    },
    "eip155:84532": {
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      name: "USDC",
      version: "2"
    },
    // ... other networks
  };
  return usdcInfo[network];
}
```

### EIP-712 Domain

```typescript
const domain = {
  name: "USD Coin",  // or "USDC"
  version: "2",
  chainId: 8453,  // or 84532, 1, etc.
  verifyingContract: "0x833589..." // USDC contract address
};
```

### Transaction Method

**Function**: `transferWithAuthorization` (EIP-3009)

**Parameters**:
```solidity
function transferWithAuthorization(
  address from,
  address to,
  uint256 value,
  uint256 validAfter,
  uint256 validBefore,
  bytes32 nonce,
  bytes memory signature
) external;
```

## Network Selection

### Client-Side

Client registers which networks it supports:

```typescript
const fetchWithPayment = wrapFetchWithPayment(fetch, {
  schemes: [
    {
      network: "eip155:8453",  // Base Mainnet
      client: new ExactEvmClient(account)
    },
    {
      network: "eip155:84532",  // Base Sepolia
      client: new ExactEvmClient(account)
    }
  ]
});
```

### Server-Side

Server specifies which network to accept:

```typescript
app.use(paymentMiddleware({
  "GET /protected": {
    payTo: ADDRESS,
    scheme: "exact",
    price: "$0.001",
    network: "eip155:84532"  // Only accept Base Sepolia
  }
}, facilitator, schemes));
```

### Matching

Client filters server's `accepts` array to find compatible network:

```typescript
const supportedRequirements = accepts.filter(req => {
  // Check if client has a scheme registered for this network
  return clientSchemesByNetwork.has(req.network) &&
         clientSchemesByNetwork.get(req.network).has(req.scheme);
});
```

## Network-Specific Considerations

### Gas Costs

| Network | Avg Gas Cost | Settlement Time |
|---------|--------------|-----------------|
| Base Mainnet | ~$0.0001 | ~2 seconds |
| Base Sepolia | Free (testnet) | ~2 seconds |
| Ethereum | ~$1-10 | ~12 seconds |
| Ethereum Sepolia | Free (testnet) | ~12 seconds |

**Recommendation**: Use L2s like Base for production to minimize gas costs.

### Block Times

| Network | Block Time | Confirmation Time |
|---------|-----------|-------------------|
| Base | ~2 seconds | ~2 seconds |
| Ethereum | ~12 seconds | ~12 seconds |
| Solana | ~400ms | ~400ms |

### Token Decimals

**USDC**: 6 decimals on all EVM chains

**Price Conversion**:
```typescript
// "$0.001" = 0.001 * 10^6 = 1000 (smallest units)
const amount = Math.floor(0.001 * Math.pow(10, 6));  // 1000
```

## Multi-Network Support

### Server Configuration

Accept multiple networks:

```typescript
app.use(paymentMiddleware({
  "GET /protected": [
    {
      payTo: EVM_ADDRESS,
      scheme: "exact",
      price: "$0.001",
      network: "eip155:8453"  // Base
    },
    {
      payTo: EVM_ADDRESS,
      scheme: "exact",
      price: "$0.001",
      network: "eip155:1"  // Ethereum
    }
  ]
}, facilitator, schemes));
```

**Note**: Current reference implementation shows single network per route. Multi-network would require array support in `RoutesConfig`.

## Reference Implementation

- **EVM Client**: `typescript/packages/mechanisms/evm/src/exact/index.ts`
- **Network Constants**: `typescript/packages/mechanisms/evm/src/exact/index.ts:384-415`
- **E2E Test Config**: `e2e/src/discovery.ts:14-24`

## Next Steps

- **Protocol Overview**: [Payment Flow Overview](./payment-flow-overview.md)
- **Implementation**: [Architecture](../04-reference-implementation/architecture.md)
