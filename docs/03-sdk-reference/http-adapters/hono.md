<!-- VERIFIED: 0aa62c64 -->
# @x402/hono

Hono middleware for adding x402 payment requirements to your Hono applications.

## Installation

```bash
pnpm add @x402/hono @x402/evm
```

## Quick Start

```typescript
import { Hono } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const app = new Hono();

// Connect to facilitator
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org"
});

// Create and configure resource server
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

// Apply payment middleware
app.use(
  paymentMiddleware(
    {
      "GET /protected": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532",
          payTo: "0xYourAddress",
          price: "$0.001",
        },
        description: "Protected endpoint",
      },
    },
    server
  )
);

// Implement protected route
app.get("/protected", (c) => {
  return c.json({ message: "Paid content" });
});

export default app;
```

## paymentMiddleware Function

Creates Hono middleware that enforces x402 payment requirements for specified routes.

```typescript
function paymentMiddleware(
  routes: RoutesConfig,
  server: x402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart?: boolean
): MiddlewareHandler
```

**Parameters:**

1. **`routes`** (required): Route configurations for protected endpoints
2. **`server`** (required): Pre-configured x402ResourceServer instance
3. **`paywallConfig`** (optional): Configuration for the built-in paywall UI
4. **`paywall`** (optional): Custom paywall provider (overrides default)
5. **`syncFacilitatorOnStart`** (optional, default: `true`): Whether to sync with the facilitator on startup

**Returns:** Hono middleware handler function

**How it works:**

1. Checks if the incoming request matches a protected route
2. Validates payment headers if required
3. Returns 402 with payment instructions if payment is missing or invalid
4. Processes the request if payment is valid
5. Handles settlement after successful response

## paymentMiddlewareFromConfig Function

Creates middleware with configuration-based setup. Use this for simpler applications where you don't need to reuse the server instance.

```typescript
function paymentMiddlewareFromConfig(
  routes: RoutesConfig,
  facilitatorClients?: FacilitatorClient | FacilitatorClient[],
  schemes?: SchemeRegistration[],
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart?: boolean
): MiddlewareHandler
```

**Parameters:**

1. **`routes`** (required): Route configurations for protected endpoints
2. **`facilitatorClients`** (optional): Facilitator client(s) for payment processing
3. **`schemes`** (optional): Array of scheme registrations for server-side payment processing
4. **`paywallConfig`** (optional): Configuration for the built-in paywall UI
5. **`paywall`** (optional): Custom paywall provider (overrides default)
6. **`syncFacilitatorOnStart`** (optional, default: `true`): Whether to sync with the facilitator on startup

**Returns:** Hono middleware handler function

**When to use:** Use this function when you want simple, quick setup without managing the server instance yourself.

## Route Configuration

Routes are configured as a mapping from route patterns to payment requirements.

### Route Pattern Format

Route patterns use the format `"METHOD /path"`:

```typescript
const routes = {
  "GET /api/data": { /* config */ },
  "POST /api/compute": { /* config */ },
  "GET /api/premium/*": { /* config - wildcard paths */ },
};
```

### RouteConfig Object

```typescript
interface RouteConfig {
  accepts: PaymentOption | PaymentOption[];
  description?: string;
}
```

**Fields:**

- **`accepts`**: Payment option(s) - can be a single object or array for multiple payment methods
- **`description`**: Human-readable description of the endpoint

### PaymentOption Object

```typescript
interface PaymentOption {
  scheme: string;
  payTo: string;
  price: string;
  network: string;
  maxTimeoutSeconds?: number;
}
```

**Fields:**

- **`scheme`**: Payment scheme identifier (e.g., `"exact"`)
- **`payTo`**: Recipient address
- **`price`**: Price string (e.g., `"$0.001"`)
- **`network`**: CAIP-2 network identifier (e.g., `"eip155:84532"`)
- **`maxTimeoutSeconds`**: Optional payment timeout in seconds

## Price Formats

Prices are specified as fiat-denominated strings:

```typescript
{
  price: "$0.001",  // One-tenth of a cent
  price: "$0.01",   // One cent
  price: "$1.00",   // One dollar
}
```

The facilitator converts these to on-chain token amounts (e.g., USDC) at verification time.

## Multiple Payment Options

Support multiple chains by providing an array of payment options:

```typescript
app.use(
  paymentMiddleware(
    {
      "POST /api/compute": {
        accepts: [
          {
            scheme: "exact",
            network: "eip155:84532",
            payTo: "0xEvmAddress",
            price: "$0.01",
          },
          {
            scheme: "exact",
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            payTo: "SolanaAddress",
            price: "$0.01",
          },
        ],
        description: "Multi-chain compute endpoint",
      },
    },
    server
  )
);
```

Clients can choose which network to pay on based on their available wallets.

## Complete Example

```typescript
import { Hono } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";

const app = new Hono();

// Configure facilitator connection
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org",
});

// Create resource server
const server = new x402ResourceServer(facilitatorClient);

// Register payment schemes
registerExactEvmScheme(server);
registerExactSvmScheme(server);

// Configure routes with payment requirements
app.use(
  paymentMiddleware(
    {
      "GET /api/data": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532",
          payTo: "0xYourEvmAddress",
          price: "$0.001",
        },
        description: "Premium data access",
      },
      "POST /api/compute": {
        accepts: [
          {
            scheme: "exact",
            network: "eip155:84532",
            payTo: "0xYourEvmAddress",
            price: "$0.01",
          },
          {
            scheme: "exact",
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            payTo: "YourSolanaAddress",
            price: "$0.01",
          },
        ],
        description: "Compute endpoint with multi-chain support",
      },
    },
    server
  )
);

// Implement protected routes
app.get("/api/data", (c) => {
  return c.json({ data: "Premium content" });
});

app.post("/api/compute", (c) => {
  return c.json({ result: "Computation complete" });
});

// Public endpoint - no payment required
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

export default app;
```

## HTTP Headers

The middleware uses the following HTTP headers:

### Request Headers

- **`PAYMENT-SIGNATURE`**: Base64-encoded payment payload from client
- **`X-PAYMENT`**: Alternative header for payment payload

### Response Headers

- **`PAYMENT-REQUIRED`**: Base64-encoded payment requirements (sent with 402 status)
- **`PAYMENT-RESPONSE`**: Base64-encoded settlement confirmation (sent after successful payment)

## Network Identifiers

Network identifiers follow the CAIP-2 format: `{namespace}:{reference}`

**Common networks:**

| Network | Identifier |
|---------|------------|
| Ethereum Mainnet | `eip155:1` |
| Base Mainnet | `eip155:8453` |
| Base Sepolia | `eip155:84532` |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |

## Error Responses

### 402 Payment Required

When payment is required but not provided or invalid:

```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64-encoded-payment-requirements>
Content-Type: application/json

{"error": "Payment required"}
```

### Settlement Failures

If payment verification succeeds but settlement fails, the response body is not sent.

### Application Errors (4xx/5xx)

If your route handler returns a status code >= 400, the middleware **does not settle the payment**. This prevents charging users for failed requests.

## Next Steps

- [Server Module](../core/server.md) - Core server documentation
- [@x402/fetch](./fetch.md) - Fetch client wrapper
- [@x402/evm](../mechanisms/evm.md) - EVM payment mechanism
