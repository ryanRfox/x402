# Object Examples

Real object examples from successful payment flow.

## PaymentRequirements

```json
{
  "scheme": "exact",
  "network": "eip155:84532",
  "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "amount": "1000",
  "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "maxTimeoutSeconds": 300,
  "extra": {
    "name": "USDC",
    "version": "2"
  }
}
```

## PaymentPayload

```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "eip155:84532",
  "payload": {
    "authorization": {
      "from": "0xABC123...",
      "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "value": "1000",
      "validAfter": "1730000000",
      "validBefore": "1730000300",
      "nonce": "0x1234567890abcdef..."
    },
    "signature": "0xabcdef123456789..."
  },
  "accepted": {
    /* PaymentRequirements object */
  }
}
```

## VerifyResponse

```json
{
  "isValid": true,
  "payer": "0xABC123..."
}
```

## SettleResponse

```json
{
  "success": true,
  "transaction": "0xdef456789abc...",
  "network": "eip155:84532",
  "payer": "0xABC123..."
}
```

---

*See [Happy Path](../02-protocol-flows/happy-path.md) for context*
