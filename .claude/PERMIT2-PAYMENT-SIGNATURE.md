# PAYMENT-SIGNATURE Header - Permit2 Settlement

Captured from E2E test against `/protected-permit2` endpoint on Anvil fork of Base Sepolia.

## Header

```
PAYMENT-SIGNATURE: <base64 encoded JSON below>
```

## Base64 Encoded

```
eyJ4NDAyVmVyc2lvbiI6MiwicGF5bG9hZCI6eyJ0b2tlbiI6IjB4NDIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwNiIsImFtb3VudCI6IjEwMDAwMDAwMDAwMDAwMDAiLCJub25jZSI6IjYwMzU0NjUzOTc3MTUyODQ4NzcyNzg2MTYzMzAxMTU2NjgwMzAyNzM0OTkxMTcyMzY4MTUwOTE0MzU0NDU5NzYwMTQ2MTg4NDAwMzIwIiwiZGVhZGxpbmUiOiIxNzY1MzAyNzg5Iiwib3duZXIiOiIweDE1OUE0Mjk2QjVkYjc0OUI0YUYzMUEyQTZCRWFmMzdFRkEyQTAyMDQiLCJyZWNpcGllbnQiOiIweDE1OUE0Mjk2QjVkYjc0OUI0YUYzMUEyQTZCRWFmMzdFRkEyQTAyMDQiLCJwYXltZW50SWQiOiIweDM5N2IwNGFiYzY0MDk5NjQ1M2M4OWYyNjQ5ODQ1N2NjYTdkYmFkNjAzMTRmNmJiZWJlYzFmYmE0NzE1M2ZkMDMiLCJzaWduYXR1cmUiOiIweGFiOWE5NjY5M2JmYjBjMjBjMTcxZWI5MDRjMDIyNGRhMTdmZTYzY2ZlZGY0NDc4ZWI3ZWYxOTkzNTNhZWVmM2Y2YTc0MTgwNGNhYTQ3OWVhMGFmZDUyY2JkZmM5ZWU4NTRjYWE5ZTRhZmYwYzU5OTRjMzA5NzFjYmNlZDdmMzMzMWIifSwiZXh0ZW5zaW9ucyI6ey4uLn0sInJlc291cmNlIjp7Li4ufSwiYWNjZXB0ZWQiOnsuLi59fQ==
```

## Decoded JSON (Payload Only - Extensions/Resource Omitted)

```json
{
  "x402Version": 2,
  "payload": {
    "token": "0x4200000000000000000000000000000000000006",
    "amount": "1000000000000000",
    "nonce": "60354653977152848772786163301156680302734991172368150914354459760146188400320",
    "deadline": "1765302789",
    "owner": "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
    "recipient": "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
    "paymentId": "0x397b04abc640996453c89f26498457cca7dbad60314f6bbebec1fba47153fd03",
    "signature": "0xab9a96693bfb0c20c171eb904c0224da17fe63cfedf4478eb7ef199353aeef3f6a741804caa479ea0afd52cbdfc9ee854caa9e4aff0c5994c30971cbced7f3331b"
  },
  "extensions": { /* bazaar extension data */ },
  "resource": {
    "url": "http://localhost:4021/protected-permit2",
    "description": "",
    "mimeType": ""
  },
  "accepted": {
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "1000000000000000",
    "asset": "0x4200000000000000000000000000000000000006",
    "payTo": "0x159a4296b5db749b4af31a2a6beaf37efa2a0204",
    "maxTimeoutSeconds": 300,
    "extra": {
      "assetTransferMethod": "permit2",
      "resourceUrl": "http://localhost:4021/protected-permit2"
    }
  }
}
```

## Payload Structure: `ExactPermit2SettlementPayload`

This is the payload type defined in `typescript/packages/mechanisms/evm/src/types.ts`:

```typescript
interface ExactPermit2SettlementPayload {
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

### Message

```typescript
{
  permitted: {
    token: "0x4200000000000000000000000000000000000006",
    amount: 1000000000000000n
  },
  spender: "0xB98E0Fb673e5a0C6e15F1D0a9f36E7dA954A0D5E",  // Settlement contract
  nonce: 60354653977152848772786163301156680302734991172368150914354459760146188400320n,
  deadline: 1765302789n,
  witness: {
    token: "0x4200000000000000000000000000000000000006",
    amount: 1000000000000000n,
    recipient: "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",  // BOUND IN SIGNATURE
    paymentId: "0x397b04abc640996453c89f26498457cca7dbad60314f6bbebec1fba47153fd03",
    nonce: 60354653977152848772786163301156680302734991172368150914354459760146188400320n,
    deadline: 1765302789n
  }
}
```

## Trust Minimization

**Key difference from naive Permit2**: The `recipient` is included in the `PaymentOrder` witness struct, which is part of the signed message. This means:

1. **Facilitator cannot redirect funds** - The signature binds to a specific recipient
2. **Settlement contract enforces recipient** - Contract validates signature and sends to witness.recipient
3. **Spender is settlement contract** - Not the facilitator, so facilitator can't call Permit2 directly

## Comparison: Naive vs Settlement

| Aspect | Naive Permit2 | Settlement Permit2 |
|--------|---------------|-------------------|
| Spender | Facilitator | Settlement Contract |
| Recipient in signature | No | Yes (in witness) |
| Facilitator can redirect | Yes | No |
| On-chain enforcement | None | Settlement contract |
