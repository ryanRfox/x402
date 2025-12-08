# Capturing x402 HTTP Headers Without Code Changes

This document describes how to capture and analyze x402 payment flow HTTP headers using an inline proxy, without modifying any application code.

## Overview

The x402 payment flow uses three HTTP headers:
- `payment-required` - Server → Client (HTTP 402 response)
- `payment-signature` - Client → Server (retry request with payment)
- `payment-response` - Server → Client (HTTP 200 response after settlement)

All headers are **base64-encoded JSON**.

## Inline Node.js Proxy

Run this proxy between the client and server to capture all HTTP traffic:

```bash
# Start proxy on port 4030, forwarding to server on port 4022
node -e "
const http = require('http');
const fs = require('fs');

const TARGET_PORT = 4022;
const PROXY_PORT = 4030;
const LOG_FILE = '/tmp/proxy.log';

const log = (msg) => {
  const line = msg + '\n';
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
};

fs.writeFileSync(LOG_FILE, 'Logging proxy on http://localhost:' + PROXY_PORT + ' -> http://localhost:' + TARGET_PORT + '\n\n');

http.createServer((req, res) => {
  log('=== INCOMING REQUEST ===');
  log('Method: ' + req.method + ' ' + req.url);
  log('Headers: ' + JSON.stringify(req.headers, null, 2));

  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    if (body.length > 0) log('Body: ' + Buffer.concat(body).toString());

    const proxyReq = http.request({
      hostname: 'localhost',
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers
    }, proxyRes => {
      log('');
      log('=== RESPONSE ===');
      log('Status: ' + proxyRes.statusCode);
      log('Headers: ' + JSON.stringify(proxyRes.headers, null, 2));

      let responseBody = [];
      proxyRes.on('data', chunk => responseBody.push(chunk));
      proxyRes.on('end', () => {
        const bodyStr = Buffer.concat(responseBody).toString();
        log('Body: ' + bodyStr);
        log('');

        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        res.end(bodyStr);
      });
    });

    proxyReq.on('error', e => {
      log('Proxy error: ' + e.message);
      res.writeHead(502);
      res.end('Proxy error');
    });

    if (body.length > 0) proxyReq.write(Buffer.concat(body));
    proxyReq.end();
  });
}).listen(PROXY_PORT, () => console.log('Proxy listening on port ' + PROXY_PORT));
" &
```

## Running Tests Through the Proxy

1. **Start the proxy** (as shown above)

2. **Start the server on port 4022** (normal e2e server port)

3. **Make client requests to port 4030** instead of 4022

4. **View captured traffic**:
   ```bash
   cat /tmp/proxy.log
   ```

## Decoding Captured Headers

### Decode payment-required header
```bash
echo "eyJ4NDAy..." | base64 -d | jq .
```

### Decode payment-signature header
```bash
echo "eyJ4NDAy..." | base64 -d | jq .
```

### Decode payment-response header
```bash
echo "eyJzdWNj..." | base64 -d | jq .
```

## Example Captured Flow

### Request 1: Client → Server (no payment)
```
=== INCOMING REQUEST ===
Method: GET /protected
Headers: {
  "host": "localhost:4030",
  "accept": "*/*",
  "user-agent": "node"
}
```

### Response 1: Server → Client (402 Payment Required)
```
=== RESPONSE ===
Status: 402
Headers: {
  "payment-required": "eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIi..."
}
Body: {}
```

**Decoded `payment-required`:**
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
  ]
}
```

### Request 2: Client → Server (with payment)
```
=== INCOMING REQUEST ===
Method: GET /protected
Headers: {
  "payment-signature": "eyJ4NDAyVmVyc2lvbiI6MiwicGF5bG9hZCI6eyJhdXRob3Jpem..."
}
```

**Decoded `payment-signature`:**
```json
{
  "x402Version": 2,
  "payload": {
    "authorization": {
      "from": "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
      "to": "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
      "value": "1000",
      "validAfter": "1765207839",
      "validBefore": "1765208739",
      "nonce": "0x9176f40838b6285e022e5461f2172c8cc0b977e5fddc4ce516994..."
    },
    "signature": "0x1fbd5de4145eb69087af5f98bff09d95b18b6a2485d56441bf62bf..."
  },
  "accepted": {
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "1000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0x159a4296b5db749b4af31a2a6beaf37efa2a0204"
  }
}
```

### Response 2: Server → Client (200 OK + settlement)
```
=== RESPONSE ===
Status: 200
Headers: {
  "payment-response": "eyJzdWNjZXNzIjp0cnVlLCJ0cmFuc2FjdGlvbiI6IjB4NTBiZD..."
}
Body: {"message":"Protected endpoint accessed successfully","timestamp":"2025-12-08T15:40:39.577Z"}
```

**Decoded `payment-response`:**
```json
{
  "success": true,
  "transaction": "0x50bd3c0515d88c8ffe9f0a7624b1a4dbbdf9dd4c642103d0a75a5c7e7d07ca4c",
  "network": "eip155:84532",
  "payer": "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
  "requirements": {
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "1000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0x159a4296b5db749b4af31a2a6beaf37efa2a0204"
  }
}
```

## Verifying On-Chain Settlement

The `transaction` hash from `payment-response` can be verified:

```bash
# View transaction on Base Sepolia
cast tx 0x50bd3c0515d88c8ffe9f0a7624b1a4dbbdf9dd4c642103d0a75a5c7e7d07ca4c \
  --rpc-url https://sepolia.base.org

# Or view on block explorer
open "https://sepolia.basescan.org/tx/0x50bd3c0515d88c8ffe9f0a7624b1a4dbbdf9dd4c642103d0a75a5c7e7d07ca4c"
```

## Key Observations

1. **EIP-3009 Authorization**: The `payload.authorization` contains EIP-3009 `transferWithAuthorization` parameters:
   - `from`, `to`: Sender and recipient addresses
   - `value`: Amount in atomic units (1000 = 0.001 USDC with 6 decimals)
   - `validAfter`, `validBefore`: Time window (Unix timestamps)
   - `nonce`: 32-byte random nonce for replay protection

2. **Signature**: EIP-712 typed data signature over the authorization

3. **Settlement**: The facilitator calls `transferWithAuthorization()` on the USDC contract with the signature and authorization parameters

4. **Header Names**: V2 uses lowercase `payment-required`, `payment-signature`, `payment-response` (V1 used `X-PAYMENT`, `X-PAYMENT-RESPONSE`)

## Cleanup

```bash
# Stop the proxy
pkill -f "node -e.*PROXY_PORT"

# Remove log file
rm /tmp/proxy.log
```

## Alternative: Environment Variable Logging

For simpler logging without a proxy, some Node.js HTTP debugging can be enabled:

```bash
NODE_DEBUG=http pnpm test --facilitators=typescript --servers=express --clients=fetch --families=evm
```

However, this doesn't show the actual header values as clearly as the proxy approach.
