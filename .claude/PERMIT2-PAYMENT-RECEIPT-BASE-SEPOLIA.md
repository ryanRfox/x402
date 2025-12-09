# PAYMENT-RECEIPT Header - Permit2 Settlement (Base Sepolia)

Captured from E2E test against `/protected-permit2` endpoint on **Base Sepolia (live testnet)**.

## Header

```
PAYMENT-RECEIPT: <base64 encoded JSON below>
```

(Also returned as `PAYMENT-RESPONSE` for backwards compatibility)

## Base64 Encoded

```
eyJzdWNjZXNzIjp0cnVlLCJ0cmFuc2FjdGlvbiI6IjB4ZTZiNGE4ZjI4NjhjZDlkNjI2YzY0ZWNkNzkyMjE5NWYyOGEzMzM1OTZkN2JkNzQ4OTU4OTE5NjFiZmY5YzdkYyIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJwYXllciI6IjB4MTU5QTQyOTZCNWRiNzQ5QjRhRjMxQTJBNkJFYWYzN0VGQTJBMDIwNCIsInJlcXVpcmVtZW50cyI6eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJhbW91bnQiOiIxMDAwMDAwMDAwMDAwMDAwIiwiYXNzZXQiOiIweDQyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDYiLCJwYXlUbyI6IjB4MTU5YTQyOTZiNWRiNzQ5YjRhZjMxYTJhNmJlYWYzN2VmYTJhMDIwNCIsIm1heFRpbWVvdXRTZWNvbmRzIjozMDAsImV4dHJhIjp7ImFzc2V0VHJhbnNmZXJNZXRob2QiOiJwZXJtaXQyIiwicmVzb3VyY2VVcmwiOiJodHRwOi8vbG9jYWxob3N0OjQwMjEvcHJvdGVjdGVkLXBlcm1pdDIifX19
```

## Decoded JSON

```json
{
  "success": true,
  "transaction": "0xe6b4a8f2868cd9d626c64ecd7922195f28a333596d7bd74895891961bff9c7dc",
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
| `transaction` | `0xe6b4a8f2...` | On-chain transaction hash |
| `network` | `eip155:84532` | Base Sepolia chain ID |
| `payer` | `0x159A...0204` | Address that paid |
| `requirements.asset` | `0x4200...0006` | WETH token |
| `requirements.extra.assetTransferMethod` | `permit2` | Confirms settlement contract was used |

## Verifying the Transaction

On Base Sepolia, you can verify the transaction:

```bash
# Get transaction receipt
cast receipt 0xe6b4a8f2868cd9d626c64ecd7922195f28a333596d7bd74895891961bff9c7dc --rpc-url https://sepolia.base.org

# View on Basescan
open https://sepolia.basescan.org/tx/0xe6b4a8f2868cd9d626c64ecd7922195f28a333596d7bd74895891961bff9c7dc

# Check logs for PaymentExecuted event
cast logs --address 0xbC15B94Cb88Ef8462Daa9eb3652478887a9eA976 --rpc-url https://sepolia.base.org
```

## Settlement Contract Execution Flow

When the facilitator receives the PAYMENT-SIGNATURE, it:

1. **Decodes the payload** to get `ExactPermit2Payload`
2. **Calls settlement contract** `executePayment(order, payer, signature)`
3. **Settlement contract**:
   - Validates the PaymentOrder witness
   - Calls Permit2 `permitWitnessTransferFrom` to pull tokens from payer
   - Transfers tokens to `order.recipient` (from witness)
   - Emits `PaymentExecuted` event
4. **Facilitator returns** the transaction hash in PAYMENT-RECEIPT

## Settlement Contract Addresses

| Network | Settlement Contract | Deployment |
|---------|---------------------|------------|
| Base Sepolia | `0xbC15B94Cb88Ef8462Daa9eb3652478887a9eA976` | CREATE2 (deterministic) |
| Anvil (fork) | `0xB98E0Fb673e5a0C6e15F1D0a9f36E7dA954A0D5E` | Local deployment |
| Ethereum Sepolia | TBD | Deferred |

## Trust Minimization Verification

This transaction demonstrates trust-minimized settlement:

1. **Client signed for settlement contract** - Not the facilitator
2. **Recipient bound in witness** - `0x159a4296...` in PaymentOrder
3. **Settlement contract enforced recipient** - Tokens transferred to witness.recipient
4. **Facilitator could not redirect** - Only submit the transaction

The on-chain transaction at `0xe6b4a8f2...` can be independently verified on Basescan.
