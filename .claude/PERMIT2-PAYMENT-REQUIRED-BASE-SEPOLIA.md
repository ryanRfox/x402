# PAYMENT-REQUIRED Header - Permit2 Settlement (Base Sepolia)

Captured from E2E test against `/protected-permit2` endpoint on **Base Sepolia (live testnet)**.

## Header

```
PAYMENT-REQUIRED: <base64 encoded JSON below>
```

## Base64 Encoded

```
eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cDovL2xvY2FsaG9zdDo0MDIxL3Byb3RlY3RlZC1wZXJtaXQyIiwiZGVzY3JpcHRpb24iOiIiLCJtaW1lVHlwZSI6IiJ9LCJhY2NlcHRzIjpbeyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJhbW91bnQiOiIxMDAwMDAwMDAwMDAwMDAwIiwiYXNzZXQiOiIweDQyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDYiLCJwYXlUbyI6IjB4MTU5YTQyOTZiNWRiNzQ5YjRhZjMxYTJhNmJlYWYzN2VmYTJhMDIwNCIsIm1heFRpbWVvdXRTZWNvbmRzIjozMDAsImV4dHJhIjp7ImFzc2V0VHJhbnNmZXJNZXRob2QiOiJwZXJtaXQyIiwicmVzb3VyY2VVcmwiOiJodHRwOi8vbG9jYWxob3N0OjQwMjEvcHJvdGVjdGVkLXBlcm1pdDIifX1dLCJleHRlbnNpb25zIjp7ImJhemFhciI6eyJpbmZvIjp7ImlucHV0Ijp7InR5cGUiOiJodHRwIiwicXVlcnlQYXJhbXMiOnt9LCJtZXRob2QiOiJHRVQifSwib3V0cHV0Ijp7InR5cGUiOiJqc29uIiwiZXhhbXBsZSI6eyJtZXNzYWdlIjoiUGVybWl0MiBwcm90ZWN0ZWQgZW5kcG9pbnQgYWNjZXNzZWQgc3VjY2Vzc2Z1bGx5IiwidGltZXN0YW1wIjoiMjAyNC0wMS0wMVQwMDowMDowMFoifX19LCJzY2hlbWEiOnsiJHNjaGVtYSI6Imh0dHBzOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LzIwMjAtMTIvc2NoZW1hIiwidHlwZSI6Im9iamVjdCIsInByb3BlcnRpZXMiOnsiaW5wdXQiOnsidHlwZSI6Im9iamVjdCIsInByb3BlcnRpZXMiOnsidHlwZSI6eyJ0eXBlIjoic3RyaW5nIiwiY29uc3QiOiJodHRwIn0sIm1ldGhvZCI6eyJ0eXBlIjoic3RyaW5nIiwiZW51bSI6WyJHRVQiLCJIRUFEIiwiREVMRVRFIl19LCJxdWVyeVBhcmFtcyI6eyJ0eXBlIjoib2JqZWN0IiwicHJvcGVydGllcyI6e319fSwicmVxdWlyZWQiOlsidHlwZSIsIm1ldGhvZCJdLCJhZGRpdGlvbmFsUHJvcGVydGllcyI6ZmFsc2V9LCJvdXRwdXQiOnsidHlwZSI6Im9iamVjdCIsInByb3BlcnRpZXMiOnsidHlwZSI6eyJ0eXBlIjoic3RyaW5nIn0sImV4YW1wbGUiOnsidHlwZSI6Im9iamVjdCIsInByb3BlcnRpZXMiOnsibWVzc2FnZSI6eyJ0eXBlIjoic3RyaW5nIn0sInRpbWVzdGFtcCI6eyJ0eXBlIjoic3RyaW5nIn19LCJyZXF1aXJlZCI6WyJtZXNzYWdlIiwidGltZXN0YW1wIl19fSwicmVxdWlyZWQiOlsidHlwZSJdfX0sInJlcXVpcmVkIjpbImlucHV0Il19fX19
```

## Decoded JSON

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://localhost:4021/protected-permit2",
    "description": "",
    "mimeType": ""
  },
  "accepts": [
    {
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
  ],
  "extensions": {
    "bazaar": {
      "info": {
        "input": {
          "type": "http",
          "queryParams": {},
          "method": "GET"
        },
        "output": {
          "type": "json",
          "example": {
            "message": "Permit2 protected endpoint accessed successfully",
            "timestamp": "2024-01-01T00:00:00Z"
          }
        }
      },
      "schema": { /* ... bazaar schema ... */ }
    }
  }
}
```

## Key Fields for Permit2 Settlement

| Field | Value | Description |
|-------|-------|-------------|
| `scheme` | `exact` | Payment scheme |
| `network` | `eip155:84532` | Base Sepolia (live testnet) |
| `asset` | `0x4200000000000000000000000000000000000006` | WETH on Base Sepolia |
| `amount` | `1000000000000000` | 0.001 WETH (18 decimals) |
| `payTo` | `0x159a...0204` | Recipient address |
| `extra.assetTransferMethod` | `permit2` | **Critical**: Indicates Permit2 with settlement contract |

## Settlement Contract Address

| Network | Settlement Contract | Status |
|---------|---------------------|--------|
| Base Sepolia | `0xbC15B94Cb88Ef8462Daa9eb3652478887a9eA976` | ✅ Deployed via CREATE2 |
| Ethereum Sepolia | TBD | Deferred |

## Difference from Anvil Fork Test

This test was executed on **live Base Sepolia**, not a local Anvil fork:

| Aspect | Anvil Fork | Base Sepolia |
|--------|------------|--------------|
| Network | Local fork of Base Sepolia | Live Base Sepolia |
| Settlement Contract | `0xB98E0Fb673e5a0C6e15F1D0a9f36E7dA954A0D5E` | `0xbC15B94Cb88Ef8462Daa9eb3652478887a9eA976` |
| Transaction Finality | Instant | ~2 seconds |
| Verification | Local only | Verifiable on Basescan |
