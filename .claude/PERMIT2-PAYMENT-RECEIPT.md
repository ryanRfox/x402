# PAYMENT-RECEIPT Header - Permit2 Settlement

Captured from E2E test against `/protected-permit2` endpoint on Anvil fork of Base Sepolia.

## Header

```
X-PAYMENT-RECEIPT: <base64 encoded JSON below>
```

(Also returned as `X-PAYMENT-RESPONSE` for backwards compatibility)

## Base64 Encoded

```
eyJzdWNjZXNzIjp0cnVlLCJ0cmFuc2FjdGlvbiI6IjB4MTRjZDU4N2Y1OTA3MDRmNmJlMTQ1NzI5NzljNmZlMDMzNzg5NzIwOWY5OThiMjIxNjBjMzg2YmYxYjBiODlkYyIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJwYXllciI6IjB4MTU5QTQyOTZCNWRiNzQ5QjRhRjMxQTJBNkJFYWYzN0VGQTJBMDIwNCIsInJlcXVpcmVtZW50cyI6eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJhbW91bnQiOiIxMDAwMDAwMDAwMDAwMDAwIiwiYXNzZXQiOiIweDQyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDYiLCJwYXlUbyI6IjB4MTU5YTQyOTZiNWRiNzQ5YjRhZjMxYTJhNmJlYWYzN2VmYTJhMDIwNCIsIm1heFRpbWVvdXRTZWNvbmRzIjozMDAsImV4dHJhIjp7ImFzc2V0VHJhbnNmZXJNZXRob2QiOiJwZXJtaXQyLXNldHRsZW1lbnQiLCJyZXNvdXJjZVVybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NDAyMS9wcm90ZWN0ZWQtcGVybWl0MiJ9fX0=
```

## Decoded JSON

```json
{
  "success": true,
  "transaction": "0x14cd587f590704f6be14572979c6fe0337897209f998b22160c386bf1b0b89dc",
  "network": "eip155:84532",
  "payer": "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
  "requirements": {
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

## Key Fields

| Field | Value | Description |
|-------|-------|-------------|
| `success` | `true` | Payment was settled successfully |
| `transaction` | `0x14cd587f...` | On-chain transaction hash |
| `network` | `eip155:84532` | Base Sepolia chain ID |
| `payer` | `0x159A...0204` | Address that paid |
| `requirements.asset` | `0x4200...0006` | WETH token |
| `requirements.extra.assetTransferMethod` | `permit2` | Confirms settlement contract was used |

## Verifying the Transaction

On Anvil fork, you can verify the transaction:

```bash
# Get transaction receipt
cast receipt 0x14cd587f590704f6be14572979c6fe0337897209f998b22160c386bf1b0b89dc --rpc-url http://localhost:8545

# Check logs for PaymentExecuted event
cast logs --address 0xB98E0Fb673e5a0C6e15F1D0a9f36E7dA954A0D5E --rpc-url http://localhost:8545
```

## Settlement Contract Execution Flow

When the facilitator receives the PAYMENT-SIGNATURE, it:

1. **Decodes the payload** to get `ExactPermit2SettlementPayload`
2. **Calls settlement contract** `executePayment(order, payer, signature)`
3. **Settlement contract**:
   - Validates the PaymentOrder witness
   - Calls Permit2 `permitWitnessTransferFrom` to pull tokens from payer
   - Transfers tokens to `order.recipient` (from witness)
   - Emits `PaymentExecuted` event
4. **Facilitator returns** the transaction hash in PAYMENT-RECEIPT

## Difference from EIP-3009 Receipt

The receipt structure is identical - only the transaction execution differs:

| Transfer Method | On-Chain Call |
|-----------------|---------------|
| EIP-3009 | `token.transferWithAuthorization(from, to, ...)` |
| Permit2 Settlement | `settlement.executePayment(order, payer, sig)` → `permit2.permitWitnessTransferFrom(...)` → `token.transfer(recipient, amount)` |

## Settlement Contract Addresses

| Network | Settlement Contract |
|---------|-------------------|
| Anvil (fork) | `0xB98E0Fb673e5a0C6e15F1D0a9f36E7dA954A0D5E` |
| Base Sepolia | TBD (to be deployed) |
| Ethereum Sepolia | TBD (to be deployed) |
