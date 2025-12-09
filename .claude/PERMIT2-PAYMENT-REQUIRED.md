# PAYMENT-REQUIRED Header - Permit2 Settlement

Captured from E2E test against `/protected-permit2` endpoint on Anvil fork of Base Sepolia.

## Header

```
X-PAYMENT-REQUIRED: <base64 encoded JSON below>
```

## Base64 Encoded

```
eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cDovL2xvY2FsaG9zdDo0MDIxL3Byb3RlY3RlZC1wZXJtaXQyIiwiZGVzY3JpcHRpb24iOiIiLCJtaW1lVHlwZSI6IiJ9LCJhY2NlcHRzIjpbeyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJhbW91bnQiOiIxMDAwMDAwMDAwMDAwMDAwIiwiYXNzZXQiOiIweDQyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDYiLCJwYXlUbyI6IjB4MTU5YTQyOTZiNWRiNzQ5YjRhZjMxYTJhNmJlYWYzN2VmYTJhMDIwNCIsIm1heFRpbWVvdXRTZWNvbmRzIjozMDAsImV4dHJhIjp7ImFzc2V0VHJhbnNmZXJNZXRob2QiOiJwZXJtaXQyLXNldHRsZW1lbnQiLCJyZXNvdXJjZVVybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NDAyMS9wcm90ZWN0ZWQtcGVybWl0MiJ9fV0sImV4dGVuc2lvbnMiOnsiYmF6YWFyIjp7ImluZm8iOnsiaW5wdXQiOnsidHlwZSI6Imh0dHAiLCJxdWVyeVBhcmFtcyI6e30sIm1ldGhvZCI6IkdFVCJ9LCJvdXRwdXQiOnsidHlwZSI6Impzb24iLCJleGFtcGxlIjp7Im1lc3NhZ2UiOiJQZXJtaXQyIHByb3RlY3RlZCBlbmRwb2ludCBhY2Nlc3NlZCBzdWNjZXNzZnVsbHkiLCJ0aW1lc3RhbXAiOiIyMDI0LTAxLTAxVDAwOjAwOjAwWiJ9fX0sInNjaGVtYSI6eyIkc2NoZW1hIjoiaHR0cHM6Ly9qc29uLXNjaGVtYS5vcmcvZHJhZnQvMjAyMC0xMi9zY2hlbWEiLCJ0eXBlIjoib2JqZWN0IiwicHJvcGVydGllcyI6eyJpbnB1dCI6eyJ0eXBlIjoib2JqZWN0IiwicHJvcGVydGllcyI6eyJ0eXBlIjp7InR5cGUiOiJzdHJpbmciLCJjb25zdCI6Imh0dHAifSwibWV0aG9kIjp7InR5cGUiOiJzdHJpbmciLCJlbnVtIjpbIkdFVCIsIkhFQUQiLCJERUxFVEUiXX0sInF1ZXJ5UGFyYW1zIjp7InR5cGUiOiJvYmplY3QiLCJwcm9wZXJ0aWVzIjp7fX19LCJyZXF1aXJlZCI6WyJ0eXBlIiwibWV0aG9kIl0sImFkZGl0aW9uYWxQcm9wZXJ0aWVzIjpmYWxzZX0sIm91dHB1dCI6eyJ0eXBlIjoib2JqZWN0IiwicHJvcGVydGllcyI6eyJ0eXBlIjp7InR5cGUiOiJzdHJpbmcifSwiZXhhbXBsZSI6eyJ0eXBlIjoib2JqZWN0IiwicHJvcGVydGllcyI6eyJtZXNzYWdlIjp7InR5cGUiOiJzdHJpbmcifSwidGltZXN0YW1wIjp7InR5cGUiOiJzdHJpbmcifX0sInJlcXVpcmVkIjpbIm1lc3NhZ2UiLCJ0aW1lc3RhbXAiXX19LCJyZXF1aXJlZCI6WyJ0eXBlIl19fSwicmVxdWlyZWQiOlsiaW5wdXQiXX19fX0=
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
      "schema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
          "input": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "http"
              },
              "method": {
                "type": "string",
                "enum": ["GET", "HEAD", "DELETE"]
              },
              "queryParams": {
                "type": "object",
                "properties": {}
              }
            },
            "required": ["type", "method"],
            "additionalProperties": false
          },
          "output": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string"
              },
              "example": {
                "type": "object",
                "properties": {
                  "message": {
                    "type": "string"
                  },
                  "timestamp": {
                    "type": "string"
                  }
                },
                "required": ["message", "timestamp"]
              }
            },
            "required": ["type"]
          }
        },
        "required": ["input"]
      }
    }
  }
}
```

## Key Fields for Permit2 Settlement

| Field | Value | Description |
|-------|-------|-------------|
| `scheme` | `exact` | Payment scheme |
| `network` | `eip155:84532` | Base Sepolia |
| `asset` | `0x4200000000000000000000000000000000000006` | WETH on Base Sepolia |
| `amount` | `1000000000000000` | 0.001 WETH (18 decimals) |
| `payTo` | `0x159a...0204` | Recipient address |
| `extra.assetTransferMethod` | `permit2` | **Critical**: Indicates Permit2 with settlement contract |

## How This Differs from EIP-3009

1. **Asset**: Uses WETH (not USDC) because WETH doesn't support EIP-3009
2. **Transfer Method**: `permit2` instead of implicit EIP-3009
3. **No Token Metadata**: No `name`/`version` in extra (not needed for Permit2)

The `assetTransferMethod: "permit2"` tells the client to:
1. Sign a Permit2 `PermitWitnessTransferFrom` message
2. Include a `PaymentOrder` witness with recipient address
3. Authorize the settlement contract (not facilitator) as spender
