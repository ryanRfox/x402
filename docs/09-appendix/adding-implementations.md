# Adding Implementations

Guide to creating new client or server implementations.

## Adding a Client

### 1. Create Directory

```bash
mkdir -p e2e/clients/my-client
cd e2e/clients/my-client
```

### 2. Create test.config.json

```json
{
  "name": "my-client",
  "type": "client",
  "language": "typescript",
  "protocolFamilies": ["evm"],
  "x402Versions": [2],
  "environment": {
    "required": [
      "EVM_PRIVATE_KEY",
      "RESOURCE_SERVER_URL",
      "ENDPOINT_PATH"
    ]
  }
}
```

### 3. Implement Client

```typescript
// index.ts
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmClient } from "@x402/evm";
// ... implement client

// Output JSON to stdout
console.log(JSON.stringify({
  success: true,
  data: responseData,
  status_code: response.status,
  payment_response: decodedPaymentResponse
}));
```

### 4. Create run.sh

```bash
#!/bin/bash
pnpm tsx index.ts
```

## Adding a Server

### 1. Create Directory

```bash
mkdir -p e2e/servers/my-server
cd e2e/servers/my-server
```

### 2. Create test.config.json

```json
{
  "name": "my-server",
  "type": "server",
  "language": "typescript",
  "protocolFamilies": ["evm"],
  "x402Version": 2,
  "endpoints": [
    {
      "path": "/protected",
      "method": "GET",
      "requiresPayment": true,
      "protocolFamily": "evm"
    },
    {
      "path": "/health",
      "method": "GET",
      "health": true
    },
    {
      "path": "/close",
      "method": "POST",
      "close": true
    }
  ],
  "environment": {
    "required": ["EVM_PRIVATE_KEY", "EVM_ADDRESS"],
    "optional": ["PORT"]
  }
}
```

### 3. Implement Server

```typescript
// index.ts
import { paymentMiddleware } from "@x402/express";
import { ExactEvmService } from "@x402/evm";
// ... implement server
```

### 4. Create run.sh

```bash
#!/bin/bash
pnpm tsx index.ts
```

## Test Your Implementation

```bash
cd e2e
pnpm test -d --client=my-client --server=my-server -v
```

---

*See reference implementations in `e2e/clients/fetch` and `e2e/servers/express`*
