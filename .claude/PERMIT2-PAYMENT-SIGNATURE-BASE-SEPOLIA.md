# PAYMENT-SIGNATURE Header - Permit2 Settlement (Base Sepolia)

Captured from E2E test against `/protected-permit2` endpoint on **Base Sepolia (live testnet)**.

Note: The PAYMENT-SIGNATURE header is created client-side and submitted with the request. Unlike Anvil tests where we captured the exact bytes, this document shows the structure of the payload that was signed and submitted to Base Sepolia.

## Header

```
X-PAYMENT: <base64 encoded JSON payload>
```

## Payload Structure: `ExactPermit2Payload`

This is the payload type defined in `typescript/packages/mechanisms/evm/src/types.ts`:

```typescript
interface ExactPermit2Payload {
  token: `0x${string}`;      // Token contract address
  amount: string;            // Amount in wei
  nonce: string;             // Permit2 nonce (random 256-bit)
  deadline: string;          // Unix timestamp (seconds)
  owner: `0x${string}`;      // Payer address
  recipient: `0x${string}`; // Recipient address (cryptographically bound)
  paymentId: bytes32;        // keccak256(resourceUrl) for deduplication
  signature: `0x${string}`;  // EIP-712 signature
}
```

## Example Payload (Base Sepolia)

```json
{
  "token": "0x4200000000000000000000000000000000000006",
  "amount": "1000000000000000",
  "nonce": "<random-256-bit-value>",
  "deadline": "<unix-timestamp>",
  "owner": "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
  "recipient": "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
  "paymentId": "<keccak256(resourceUrl)>",
  "signature": "0x..."
}
```

## How The Signature is Created

The client signs a Permit2 `PermitWitnessTransferFrom` message using EIP-712:

### Domain

```typescript
{
  name: "Permit2",
  chainId: 84532,  // Base Sepolia
  verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
}
```

### Message Types

```typescript
{
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" }
  ],
  PaymentOrder: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "recipient", type: "address" },
    { name: "paymentId", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ],
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },      // Settlement contract, NOT facilitator
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "PaymentOrder" }  // Contains recipient!
  ]
}
```

### Message Structure

```typescript
{
  permitted: {
    token: "0x4200000000000000000000000000000000000006",
    amount: 1000000000000000n
  },
  spender: "0xbC15B94Cb88Ef8462Daa9eb3652478887a9eA976",  // Settlement contract (Base Sepolia)
  nonce: <random-256-bit>,
  deadline: <unix-timestamp>,
  witness: {
    token: "0x4200000000000000000000000000000000000006",
    amount: 1000000000000000n,
    recipient: "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",  // BOUND IN SIGNATURE
    paymentId: "<keccak256(resourceUrl)>",
    nonce: <random-256-bit>,
    deadline: <unix-timestamp>
  }
}
```

## Trust Minimization

**Key difference from naive Permit2**: The `recipient` is included in the `PaymentOrder` witness struct, which is part of the signed message. This means:

1. **Facilitator cannot redirect funds** - The signature binds to a specific recipient
2. **Settlement contract enforces recipient** - Contract validates signature and sends to witness.recipient
3. **Spender is settlement contract** - Not the facilitator, so facilitator can't call Permit2 directly

## Settlement Contract Addresses

| Network | Settlement Contract |
|---------|---------------------|
| Base Sepolia | `0xbC15B94Cb88Ef8462Daa9eb3652478887a9eA976` |
| Anvil (fork) | `0xB98E0Fb673e5a0C6e15F1D0a9f36E7dA954A0D5E` |
| Ethereum Sepolia | TBD (deferred) |

## Comparison: Naive vs Settlement

| Aspect | Naive Permit2 | Settlement Permit2 |
|--------|---------------|-------------------|
| Spender | Facilitator | Settlement Contract |
| Recipient in signature | No | Yes (in witness) |
| Facilitator can redirect | Yes | No |
| On-chain enforcement | None | Settlement contract |

## Successful Test Transaction

The signature was submitted and successfully settled on Base Sepolia:

- **Transaction:** `0xe6b4a8f2868cd9d626c64ecd7922195f28a333596d7bd74895891961bff9c7dc`
- **Block Explorer:** https://sepolia.basescan.org/tx/0xe6b4a8f2868cd9d626c64ecd7922195f28a333596d7bd74895891961bff9c7dc
