# x402 v2 SDK Reference for External Projects

**Purpose**: Authoritative reference for developers building applications that integrate x402 v2
**Created**: 2025-10-31
**Source**: Official x402 v2 documentation at `/docs`
**Version**: x402 v2 (TypeScript SDK)

---

## Document Status: OFFICIAL REFERENCE

This document is the **authoritative reference** for x402 v2 SDK usage. All code examples are verified against the official implementation and documentation.

**If anything conflicts with this document, this document is correct.**

---

## Table of Contents

1. [Quick Verification Checklist](#quick-verification-checklist)
2. [Core Concepts](#core-concepts)
3. [Client Implementation](#client-implementation)
4. [Server Implementation](#server-implementation)
5. [Facilitator Implementation](#facilitator-implementation)
6. [Type Definitions](#type-definitions)
7. [Common Mistakes](#common-mistakes)
8. [Testing Checklist](#testing-checklist)

---

## Quick Verification Checklist

Use this to verify your understanding is correct:

- ✅ Client uses `wrapFetchWithPayment()` from `@x402/fetch`
- ✅ Client **NEVER** manually creates `PaymentPayload` - the SDK does this
- ✅ Client **NEVER** calls facilitator directly - the wrapper does this
- ✅ Server uses `paymentMiddleware()` from `@x402/express`
- ✅ Server **NEVER** manually parses payment headers - middleware does this
- ✅ Facilitator uses `x402Facilitator` from `@x402/core/facilitator`
- ✅ Payment flows use standard HTTP headers: `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`
- ✅ All headers are **base64-encoded JSON**
- ✅ Protocol version is **2** (not 1)

---

## Core Concepts

### The Three Components

Every x402 v2 system has three components:

1. **Client** - Makes HTTP requests, handles payment automatically
2. **Server** - Protects endpoints, requires payment for access
3. **Facilitator** - Verifies signatures and settles payments on-chain

### Payment Flow

```
1. Client → Server: GET /resource
2. Server → Client: 402 Payment Required + PAYMENT-REQUIRED header
3. Client creates payment (via SDK, not manually)
4. Client → Server: GET /resource + PAYMENT-SIGNATURE header
5. Server → Facilitator: verify()
6. Facilitator verifies signature
7. Server processes request
8. Server → Facilitator: settle()
9. Facilitator executes on-chain transfer
10. Server → Client: 200 OK + PAYMENT-RESPONSE header
```

### Headers

All x402 v2 headers are **base64-encoded JSON objects**:

- `PAYMENT-REQUIRED` (Server → Client, 402 response)
- `PAYMENT-SIGNATURE` (Client → Server, retry request)
- `PAYMENT-RESPONSE` (Server → Client, 200 response)

---

## ⚠️ CRITICAL: Packages Not Published to npm

**The x402 v2 SDK packages are NOT available on npm yet.** They exist only in the local x402 repository.

### Installation Requirements

❌ **This will NOT work**:
```bash
npm install @x402/fetch @x402/evm @x402/express
# ERROR: 404 Not Found - GET https://registry.npmjs.org/@x402/fetch
```

✅ **You MUST use local file paths**:
```bash
# Replace /path/to/x402 with your actual x402 repository path
npm install \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/http/fetch \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/mechanisms/evm \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/core \
  viem
```

**Result in package.json**:
```json
{
  "dependencies": {
    "@x402/fetch": "file:../x402/typescript/packages/http/fetch",
    "@x402/evm": "file:../x402/typescript/packages/mechanisms/evm",
    "@x402/core": "file:../x402/typescript/packages/core",
    "viem": "^2.21.48"
  }
}
```

### Package Locations Reference

All x402 v2 packages are in the monorepo under `typescript/packages/`:

| Package | Path |
|---------|------|
| @x402/core | `typescript/packages/core` |
| @x402/fetch | `typescript/packages/http/fetch` |
| @x402/axios | `typescript/packages/http/axios` |
| @x402/express | `typescript/packages/http/express` |
| @x402/hono | `typescript/packages/http/hono` |
| @x402/next | `typescript/packages/http/next` |
| @x402/evm | `typescript/packages/mechanisms/evm` |
| @x402/svm | `typescript/packages/mechanisms/svm` |
| @x402/extensions | `typescript/packages/extensions` |
| @x402/paywall | `typescript/packages/paywall` |

**Base path**: `/Users/fox/Getting Started/x402/` (adjust for your system)

### Why Aren't Packages Published?

The x402 v2 SDK is in **active development** on the `v2-development` branch. Packages will be published to npm when v2.0.0 is officially released.

**📖 Complete Installation Guide**: See `/docs/00-getting-started/LOCAL_DEVELOPMENT_NOTICE.md` for detailed instructions, alternative installation methods, troubleshooting, and best practices.

---

## Client Implementation

### Important: EIP-3009 vs approve()/transferFrom()

**x402 uses EIP-3009 `transferWithAuthorization()`, NOT standard ERC-20 `approve()`/`transferFrom()` flow.**

This means:
- ✅ Users sign **one EIP-712 message** that authorizes the transfer
- ✅ Facilitator executes the transfer in **one transaction**
- ✅ Users **don't pay gas** (facilitator pays)
- ✅ **No token approvals** needed (no `approve()` step)
- ✅ Built-in **replay protection** via nonce

**If you're familiar with ERC-20 tokens**, note that x402 does NOT require users to:
- Call `approve()` to set an allowance
- Wait for an approval transaction to confirm
- Pay gas for approval
- Manage or revoke allowances

The ExactEvmClient handles EIP-3009 authorization automatically.

### Package Requirements

**Install using local file paths** (NOT from npm):

```bash
npm install \
  file:/path/to/x402/typescript/packages/http/fetch \
  file:/path/to/x402/typescript/packages/mechanisms/evm \
  file:/path/to/x402/typescript/packages/core \
  viem
```

**Resulting package.json**:
```json
{
  "dependencies": {
    "@x402/fetch": "file:../x402/typescript/packages/http/fetch",
    "@x402/evm": "file:../x402/typescript/packages/mechanisms/evm",
    "@x402/core": "file:../x402/typescript/packages/core",
    "viem": "^2.21.48"
  }
}
```

### Basic Setup

```typescript
import { wrapFetchWithPayment, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmClient } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

// 1. Create account from private key
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// 2. Wrap fetch with payment handling
const fetchWithPayment = wrapFetchWithPayment(fetch, {
  schemes: [
    {
      network: "eip155:*",  // Matches any EVM network
      client: new ExactEvmClient(account),
    },
  ],
});

// 3. Use wrapped fetch - payments handled automatically
const response = await fetchWithPayment('http://server/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'value' })
});

// 4. Check payment settlement (optional)
const paymentHeader = response.headers.get("PAYMENT-RESPONSE");
if (paymentHeader) {
  const payment = decodePaymentResponseHeader(paymentHeader);
  console.log('Paid:', payment.transaction);
  console.log('Network:', payment.network);
  console.log('Payer:', payment.payer);
}
```

### What the Wrapper Does Automatically

The `fetchWithPayment` wrapper handles the complete payment flow:

1. **Makes initial request** to the server
2. **Detects 402 response** with `PAYMENT-REQUIRED` header
3. **Decodes base64 header** to get payment requirements
4. **Calls `client.createPaymentPayload()`** with requirements
5. **Creates EIP-712 signature** (for EVM) with proper authorization
6. **Encodes payment as base64** in `PAYMENT-SIGNATURE` header
7. **Retries request** with payment header
8. **Returns final response** (200 OK with `PAYMENT-RESPONSE`)

**CRITICAL**: You do NOT manually create `PaymentPayload` or call the facilitator. The SDK does everything.

### Network Matching

```typescript
// Match specific network
{ network: "eip155:8453", client: new ExactEvmClient(account) }

// Match all EVM networks
{ network: "eip155:*", client: new ExactEvmClient(account) }

// Multiple networks
schemes: [
  { network: "eip155:8453", client: evmClient },    // Base
  { network: "eip155:84532", client: evmClient },   // Base Sepolia
  { network: "solana:*", client: svmClient },       // All Solana
]
```

---

## Server Implementation

### Package Requirements

**Install using local file paths** (NOT from npm):

```bash
npm install \
  file:/path/to/x402/typescript/packages/http/express \
  file:/path/to/x402/typescript/packages/core \
  file:/path/to/x402/typescript/packages/mechanisms/evm \
  express \
  viem
```

**Resulting package.json**:
```json
{
  "dependencies": {
    "@x402/express": "file:../x402/typescript/packages/http/express",
    "@x402/core": "file:../x402/typescript/packages/core",
    "@x402/evm": "file:../x402/typescript/packages/mechanisms/evm",
    "express": "^4.21.2",
    "viem": "^2.21.48"
  }
}
```

### Basic Setup with Embedded Facilitator

```typescript
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { ExactEvmService } from "@x402/evm";
import { x402Facilitator } from "@x402/core/facilitator";
import { FacilitatorClient } from "@x402/core/server";
import { ExactEvmFacilitator, toFacilitatorEvmSigner } from "@x402/evm";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

// Network constant
const NETWORK = "eip155:31337" as const;  // Anvil local

// 1. Setup facilitator wallet
const account = privateKeyToAccount(process.env.FACILITATOR_KEY as `0x${string}`);

const viemClient = createWalletClient({
  account,
  chain: foundry,
  transport: http('http://localhost:8545')
}).extend(publicActions);

// 2. Initialize x402 facilitator
const facilitator = new x402Facilitator();

// 3. Register EVM scheme
facilitator.registerScheme(
  NETWORK,
  new ExactEvmFacilitator(
    toFacilitatorEvmSigner({
      readContract: (args: any) => viemClient.readContract({ ...args, args: args.args || [] }),
      verifyTypedData: (args: any) => viemClient.verifyTypedData(args),
      writeContract: (args: any) => viemClient.writeContract({ ...args, args: args.args || [] }),
      waitForTransactionReceipt: (args: any) => viemClient.waitForTransactionReceipt(args),
    })
  )
);

// 4. Wrap facilitator as FacilitatorClient
class LocalFacilitatorClient implements FacilitatorClient {
  readonly scheme = "exact";
  readonly x402Version = 2;

  constructor(private readonly facilitator: x402Facilitator) {}

  verify(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements) {
    return this.facilitator.verify(paymentPayload, paymentRequirements);
  }

  settle(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements) {
    return this.facilitator.settle(paymentPayload, paymentRequirements);
  }

  getSupported() {
    return Promise.resolve({
      kinds: [{
        x402Version: this.x402Version,
        scheme: this.scheme,
        network: NETWORK,
        extra: {},
      }],
      extensions: [],
    });
  }
}

const localFacilitatorClient = new LocalFacilitatorClient(facilitator);

// 5. Create Express app with middleware
const app = express();
app.use(express.json());

app.use(
  paymentMiddleware(
    // Route configuration
    {
      "POST /api/endpoint": {
        payTo: process.env.PAYEE_ADDRESS,
        scheme: "exact",
        price: "$0.001",  // 0.001 USDC
        network: NETWORK,
      },
    },
    // Facilitator client
    localFacilitatorClient,
    // Scheme handlers
    [{ network: NETWORK, server: new ExactEvmService() }]
  )
);

// 6. Define protected endpoint
app.post("/api/endpoint", (req, res) => {
  // Payment already verified and settled by middleware
  res.json({ result: "success" });
});

app.listen(3000);
```

### What the Middleware Does Automatically

1. **Checks route configuration** against incoming request
2. **If no payment header**: Returns `402 Payment Required` with `PAYMENT-REQUIRED` header
3. **If payment header present**:
   - Decodes `PAYMENT-SIGNATURE` header (base64)
   - Calls `facilitatorClient.verify(paymentPayload, requirements)`
   - If invalid: Returns 402 with error
   - If valid: Passes request to route handler
4. **After successful response**:
   - Calls `facilitatorClient.settle(paymentPayload, requirements)`
   - Adds `PAYMENT-RESPONSE` header with settlement details
   - Returns response to client

**CRITICAL**: You do NOT manually parse headers, call verify/settle, or create payment responses. The middleware does everything.

### Route Configuration Options

```typescript
{
  "POST /api/endpoint": {
    // Required fields
    payTo: string,          // Recipient address
    scheme: "exact",        // Payment scheme
    price: "$0.001",        // Price (string or object)
    network: Network,       // e.g., "eip155:8453"

    // Optional fields
    maxTimeoutSeconds: 300,       // Default: 300
    resource: string,             // Resource URL (auto-detected)
    description: string,          // Human-readable description
    mimeType: string,             // Response content type
    customPaywallHtml: string,    // Custom paywall HTML
    discoverable: boolean,        // Include in discovery
    inputSchema: any,             // Input validation schema
    outputSchema: any,            // Output schema for docs
  }
}
```

### Using Remote Facilitator

```typescript
import { HTTPFacilitatorClient } from '@x402/core/server';

// Replace localFacilitatorClient with:
const remoteFacilitatorClient = new HTTPFacilitatorClient({
  url: 'http://localhost:4022'
});

// Use in middleware
app.use(
  paymentMiddleware(
    routes,
    remoteFacilitatorClient,  // Remote instead of local
    schemes
  )
);
```

**Note**: Constructor takes a config object with `url` property, not a string directly.

---

## Facilitator Implementation

### Embedded Facilitator (Recommended for Simple Cases)

Each server embeds its own facilitator instance (shown in server section above).

**Pros**:
- Simpler architecture
- No separate service to manage
- Faster (in-process)

**Cons**:
- Each server needs wallet with ETH for gas
- Duplicated facilitator logic

### Standalone HTTP Facilitator

Create a separate facilitator service that multiple servers can use.

#### Facilitator Server

```typescript
// facilitator/src/index.ts
import express from 'express';
import { x402Facilitator } from '@x402/core/facilitator';
import { ExactEvmFacilitator, toFacilitatorEvmSigner } from '@x402/evm';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const app = express();
app.use(express.json());

// Setup facilitator (same as server embedded version)
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const viemClient = createWalletClient({
  account,
  chain: foundry,
  transport: http('http://localhost:8545')
}).extend(publicActions);

const facilitator = new x402Facilitator();
facilitator.registerScheme(
  "eip155:31337",
  new ExactEvmFacilitator(toFacilitatorEvmSigner({
    readContract: (args) => viemClient.readContract({ ...args, args: args.args || [] }),
    verifyTypedData: (args) => viemClient.verifyTypedData(args),
    writeContract: (args) => viemClient.writeContract({ ...args, args: args.args || [] }),
    waitForTransactionReceipt: (args) => viemClient.waitForTransactionReceipt(args),
  }))
);

// Required endpoints per x402 v2 facilitator protocol

// POST /verify - Verify payment signature
app.post('/verify', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /settle - Settle payment on-chain
app.post('/settle', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /supported - Advertise supported schemes
app.get('/supported', async (req, res) => {
  try {
    const result = await facilitator.getSupported();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /health - Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// POST /close - Graceful shutdown
app.post('/close', (req, res) => {
  res.json({ status: 'closing' });
  setTimeout(() => process.exit(0), 100);
});

const PORT = process.env.PORT || 4022;
app.listen(PORT, () => {
  console.log(`Facilitator listening on port ${PORT}`);
});
```

#### Using Remote Facilitator in Servers

```typescript
import { HTTPFacilitatorClient } from '@x402/core/server';

// Create client pointing to facilitator service
const facilitatorClient = new HTTPFacilitatorClient({
  url: 'http://localhost:4022'
});

// Use in middleware (same as before)
app.use(
  paymentMiddleware(routes, facilitatorClient, schemes)
);
```

---

## Type Definitions

### PaymentRequired (Server → Client)

Sent in `PAYMENT-REQUIRED` header when 402 is returned.

```typescript
interface PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: PaymentRequirements[];
  extensions?: Record<string, any>;
}

interface PaymentRequirements {
  scheme: string;              // e.g., "exact"
  network: Network;            // e.g., "eip155:31337"
  asset: string;               // Token contract address
  amount: string;              // Amount in token's smallest unit
  payTo: string;               // Recipient address
  maxTimeoutSeconds: number;   // Payment validity period
  extra?: Record<string, any>; // Scheme-specific data
}
```

**Example JSON**:
```json
{
  "x402Version": 2,
  "resource": {
    "url": "http://localhost:3000/api/endpoint"
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:31337",
    "asset": "0x9A676e781A523b5d0C0e43731313A708CB607508",
    "amount": "1000",
    "payTo": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "maxTimeoutSeconds": 300,
    "extra": {
      "name": "Mock USDC",
      "version": "2"
    }
  }]
}
```

### PaymentPayload (Client → Server)

Sent in `PAYMENT-SIGNATURE` header when retrying with payment.

```typescript
interface PaymentPayload {
  x402Version: 2;
  scheme: string;
  network: Network;
  payload: ExactEvmPayload;  // Scheme-specific payload
  accepted: PaymentRequirements;
}

interface ExactEvmPayload {
  authorization: {
    from: string;        // Payer address
    to: string;          // Payee address
    value: string;       // Amount
    validAfter: string;  // Unix timestamp
    validBefore: string; // Unix timestamp
    nonce: string;       // Hex nonce (32 bytes)
  };
  signature: string;     // EIP-712 signature
}
```

**Example JSON**:
```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "eip155:31337",
  "payload": {
    "authorization": {
      "from": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      "to": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "value": "1000",
      "validAfter": "1730000000",
      "validBefore": "1730000300",
      "nonce": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    },
    "signature": "0xabcdef123456..."
  },
  "accepted": { /* original PaymentRequirements */ }
}
```

### PaymentResponse (Server → Client)

Sent in `PAYMENT-RESPONSE` header with 200 OK response.

```typescript
interface PaymentResponse {
  success: boolean;
  transaction?: string;  // Transaction hash
  network: Network;
  payer: string;
  error?: string;
}
```

**Example JSON**:
```json
{
  "success": true,
  "transaction": "0xdef456789abc...",
  "network": "eip155:31337",
  "payer": "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
}
```

---

## Common Mistakes

### ❌ MISTAKE 1: Manually Creating PaymentPayload

```typescript
// WRONG - Don't do this!
const auth = await wallet.signPaymentAuthorization({
  payer, payee, amount, token
});

const paymentPayload = {
  x402Version: 2,
  scheme: 'exact',
  payload: { authorization: auth, signature: sig }
};
```

**✅ CORRECT**: Let the SDK create it:
```typescript
const fetchWithPayment = wrapFetchWithPayment(fetch, {
  schemes: [{ network: "eip155:*", client: new ExactEvmClient(account) }]
});
// Wrapper calls client.createPaymentPayload() automatically
```

### ❌ MISTAKE 2: Client Calling Facilitator Directly

```typescript
// WRONG - Don't do this!
await fetch('http://facilitator:4022/settle', {
  method: 'POST',
  body: JSON.stringify({ paymentPayload, requirements })
});
```

**✅ CORRECT**: The client never calls the facilitator. The server's middleware calls the facilitator.

### ❌ MISTAKE 3: Manually Parsing Payment Headers

```typescript
// WRONG - Don't do this!
app.post('/endpoint', async (req, res) => {
  const paymentHeader = req.headers['payment-signature'];
  const payment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
  const verified = await facilitator.verify(payment, requirements);
  // ...
});
```

**✅ CORRECT**: Use `paymentMiddleware()` which handles all header parsing and facilitator calls.

### ❌ MISTAKE 4: Wrong HTTPFacilitatorClient Constructor

```typescript
// WRONG - Constructor doesn't accept string directly
const client = new HTTPFacilitatorClient('http://localhost:4022');
```

**✅ CORRECT**: Pass config object:
```typescript
const client = new HTTPFacilitatorClient({ url: 'http://localhost:4022' });
```

### ❌ MISTAKE 5: Using Custom Payment Headers

```typescript
// WRONG - Custom headers
headers: { 'X-Payment-Sig': signature }
```

**✅ CORRECT**: Use standard x402 v2 headers:
- `PAYMENT-REQUIRED`
- `PAYMENT-SIGNATURE`
- `PAYMENT-RESPONSE`

### ❌ MISTAKE 6: Not Base64-Encoding Headers

```typescript
// WRONG - Sending raw JSON
headers: { 'PAYMENT-SIGNATURE': JSON.stringify(paymentPayload) }
```

**✅ CORRECT**: All headers are base64-encoded:
```typescript
headers: {
  'PAYMENT-SIGNATURE': Buffer.from(JSON.stringify(paymentPayload)).toString('base64')
}
```
(But use the SDK functions - don't encode manually)

---

## Testing Checklist

Use this to verify your integration:

### Client Testing
- [ ] Client wrapper detects 402 response automatically
- [ ] Client creates valid PaymentPayload via ExactEvmClient
- [ ] Client retries with PAYMENT-SIGNATURE header (base64-encoded)
- [ ] Client receives 200 OK with PAYMENT-RESPONSE header
- [ ] Client can decode PAYMENT-RESPONSE with `decodePaymentResponseHeader()`
- [ ] Client never calls facilitator directly
- [ ] Token balance decreases for client after payment

### Server Testing
- [ ] Server returns 402 for unpaid requests
- [ ] Server includes PAYMENT-REQUIRED header (base64-encoded)
- [ ] Server middleware calls facilitator.verify()
- [ ] Server middleware calls facilitator.settle()
- [ ] Server passes verified requests to route handler
- [ ] Server includes PAYMENT-RESPONSE header in 200 response
- [ ] Server never manually parses payment headers
- [ ] Token balance increases for payee after settlement

### Facilitator Testing
- [ ] Facilitator verifies EIP-712 signatures correctly
- [ ] Facilitator rejects invalid signatures
- [ ] Facilitator settles via `transferWithAuthorization` on-chain
- [ ] Facilitator returns transaction hash in settlement
- [ ] Facilitator has ETH for gas fees
- [ ] Facilitator handles network-specific configuration

### Integration Testing
- [ ] Full flow: 402 → payment → 200 works end-to-end
- [ ] Token balances change correctly (client -amount, payee +amount)
- [ ] On-chain transaction appears on blockchain
- [ ] Multiple payments work sequentially
- [ ] Error handling works (invalid payment, insufficient funds, etc.)

---

## Quick Reference: Key Functions

### Client Functions
```typescript
// From @x402/fetch
wrapFetchWithPayment(fetch, config) // Wrap fetch with payment handling
decodePaymentResponseHeader(header) // Decode PAYMENT-RESPONSE header

// From @x402/evm
new ExactEvmClient(account) // Create EVM payment client
```

### Server Functions
```typescript
// From @x402/express
paymentMiddleware(routes, facilitator, schemes) // Payment middleware

// From @x402/evm
new ExactEvmService() // Create EVM payment verifier

// From @x402/core/facilitator
new x402Facilitator() // Create facilitator instance
facilitator.registerScheme(network, handler) // Register payment scheme

// From @x402/evm
new ExactEvmFacilitator(signer) // Create EVM facilitator
toFacilitatorEvmSigner(viemClient) // Convert viem client to signer

// From @x402/core/server
new HTTPFacilitatorClient({ url }) // Create HTTP facilitator client
```

---

## Documentation References

For complete documentation, see:

- **Client**: `/docs/03-sdk-reference/http-adapters/fetch.md`
- **Server**: `/docs/03-sdk-reference/http-adapters/express.md`
- **EVM**: `/docs/03-sdk-reference/mechanisms/evm.md`
- **Facilitator**: `/docs/03-sdk-reference/core/facilitator.md`
- **Core Types**: `/docs/03-sdk-reference/core/types.md`
- **Quick Starts**: `/docs/00-getting-started/`
- **Tutorials**: `/docs/07-tutorials/`
- **Reference Implementations**: `/docs/10-reference-implementations/`

---

## Version Information

- **Protocol**: x402 v2
- **SDK**: TypeScript implementation
- **Tested with**: Viem 2.x, Express 4.x, Node.js 18+
- **Networks**: EVM (Ethereum, Base, Base Sepolia, Anvil local)

---

## Support

If something doesn't work as documented here:

1. **First**: Verify you're using the patterns exactly as shown
2. **Second**: Check the official docs in `/docs/`
3. **Third**: Review reference implementations in `/docs/10-reference-implementations/`

**This document is the source of truth for x402 v2 SDK usage.**

Last updated: 2025-10-31
