<!-- VERIFIED: 0aa62c64 -->

# Next.js HTTP Adapter

The `@x402/next` package provides Next.js App Router integration for the x402 Payment Protocol. It offers two complementary approaches for protecting your API routes with payment requirements.

## Installation

```bash
npm install @x402/next
```

## Core Concepts

The Next.js adapter provides two main patterns:

1. **`paymentProxy`** - Middleware that intercepts all requests matching configured routes
2. **`withX402`** - Route handler wrapper that protects individual endpoints

Both approaches handle the full x402 payment flow: checking for payment headers, returning 402 Payment Required responses, verifying payments, and processing settlement.

## Middleware Approach: `paymentProxy`

The `paymentProxy` function creates Next.js middleware that protects multiple routes in a single configuration.

### Basic Setup

Create a `middleware.ts` file in your project root:

```typescript
import { paymentProxy } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

// Create facilitator client
const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
});

// Create and configure server
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

// Define protected routes
export const middleware = paymentProxy(
  {
    "/api/protected": {
      accepts: {
        scheme: "exact",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE",
        price: "$0.01",
        network: "eip155:84532",
      },
      description: "Access to protected API endpoint",
    },
    "/api/premium/*": {
      accepts: {
        scheme: "exact",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE",
        price: "$0.05",
        network: "eip155:84532",
      },
      description: "Premium API access",
    },
  },
  server
);

export const config = {
  matcher: ["/api/protected", "/api/premium/:path*"],
};
```

Then create your route handlers normally - they'll automatically be protected:

```typescript
// app/api/protected/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "This is protected content",
    data: { /* your data */ },
  });
}
```

### Configuration

#### Route Configuration

Each protected route needs payment configuration:

```typescript
{
  accepts: {
    scheme: "exact",           // Payment scheme (e.g., "exact")
    network: "eip155:84532",   // Blockchain network
    payTo: "0x...",            // Recipient address
    price: "$0.01",            // Price in USD or custom format
  },
  description: "Route description",  // Optional: shown in paywall
  maxTimeoutSeconds: 600,            // Optional: payment timeout
}
```

Price formats:
- String: `"$0.01"` or `"0.001"` (interpreted as USD)
- Object: `{ amount: "1000000", asset: "USDC" }` (specific asset)

#### Paywall Configuration

Enable the built-in paywall UI by passing `PaywallConfig`:

```typescript
export const middleware = paymentProxy(
  routes,
  server,
  {
    appName: "My App",
    appLogo: "/logo.svg",
    sessionTokenEndpoint: "/api/x402/session-token",
  }
);
```

The paywall automatically displays when:
- A browser requests a protected endpoint
- No valid payment is provided

### API Reference: `paymentProxy`

```typescript
function paymentProxy(
  routes: RoutesConfig,
  server: x402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart: boolean = true,
): (request: NextRequest) => Promise<NextResponse>
```

**Parameters:**
- `routes` - Route configuration mapping paths to payment requirements
- `server` - Pre-configured x402ResourceServer instance
- `paywallConfig` - Optional paywall UI configuration
- `paywall` - Optional custom paywall provider (overrides default)
- `syncFacilitatorOnStart` - Whether to sync with facilitator on startup (default: true)

**Returns:** Next.js middleware function

### Behavior

When a request matches a protected route:

1. **No Payment** - Returns 402 Payment Required with payment instructions
2. **Invalid Payment** - Returns 402 with updated instructions
3. **Valid Payment** - Proceeds to route handler, settles payment in response headers
4. **Unprotected Route** - Passes through unchanged

## Route Handler Approach: `withX402`

The `withX402` wrapper protects individual route handlers with more granular control.

### Basic Setup

```typescript
// app/api/protected/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

// Setup server (shared across handlers)
const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL,
});
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

// Your actual handler
const handler = async (request: NextRequest) => {
  return NextResponse.json({
    message: "Protected content",
    timestamp: new Date().toISOString(),
  });
};

// Wrap with payment protection
export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE",
      price: "$0.01",
      network: "eip155:84532",
    },
    description: "Premium API access",
  },
  server
);
```

### Multi-HTTP-Method Example

```typescript
// app/api/data/route.ts
import { withX402 } from "@x402/next";
import { server } from "@/lib/x402-server";

const getHandler = async (request: NextRequest) => {
  return NextResponse.json({ data: "GET response" });
};

const postHandler = async (request: NextRequest) => {
  const body = await request.json();
  return NextResponse.json({ success: true, received: body });
};

const paymentConfig = {
  accepts: {
    scheme: "exact",
    payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE",
    price: "$0.02",
    network: "eip155:84532",
  },
};

export const GET = withX402(getHandler, paymentConfig, server);
export const POST = withX402(postHandler, paymentConfig, server);
```

### API Reference: `withX402`

```typescript
function withX402<T = unknown>(
  routeHandler: (request: NextRequest) => Promise<NextResponse<T>>,
  routeConfig: RouteConfig,
  server: x402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart: boolean = true,
): (request: NextRequest) => Promise<NextResponse<T>>
```

**Parameters:**
- `routeHandler` - Your original Next.js route handler
- `routeConfig` - Payment configuration for this route
- `server` - Pre-configured x402ResourceServer instance
- `paywallConfig` - Optional paywall UI configuration
- `paywall` - Optional custom paywall provider
- `syncFacilitatorOnStart` - Whether to sync with facilitator on startup (default: true)

**Returns:** Wrapped route handler

### Key Differences from `paymentProxy`

| Aspect | `paymentProxy` | `withX402` |
|--------|---|---|
| Configuration | Multiple routes at once | Single route per handler |
| Middleware | Uses Next.js middleware | Direct handler wrapper |
| File Location | `middleware.ts` | `app/api/*/route.ts` |
| Settlement Timing | After request reaches handler | Only if handler returns 2xx/3xx |
| Error Handling | Returns 402 automatically | Handler controls response |

**Key advantage of `withX402`:** Payment is only settled if your handler returns a successful response (status < 400). This ensures users aren't charged for failed requests.

## Server Configuration

Both approaches require a pre-configured `x402ResourceServer`. Here's how to set it up:

### With EVM Support

```typescript
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator",
});

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);
```

### With Multiple Chains

```typescript
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";

const server = new x402ResourceServer(facilitatorClient);

// Support multiple chains
registerExactEvmScheme(server);
registerExactSvmScheme(server);
```

### Sharing Configuration

Store your server configuration in a shared module:

```typescript
// lib/x402-server.ts
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
});

export const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);
```

Then import in your middleware and route handlers:

```typescript
// middleware.ts
import { paymentProxy } from "@x402/next";
import { server } from "@/lib/x402-server";

export const middleware = paymentProxy(routes, server);
```

## Request Flow

### With Payment (Happy Path)

```
Client Request (no payment)
    ↓
Middleware/Wrapper checks payment requirement
    ↓
Returns 402 Payment Required with payment instructions
    ↓
Client creates payment and retries
    ↓
Middleware/Wrapper verifies payment
    ↓
Route handler executes
    ↓
Settlement headers added to response
    ↓
Client confirms payment settled
```

### Settlement Guarantees

- **`paymentProxy`**: Settlement occurs after any successful middleware response
- **`withX402`**: Settlement only occurs if route handler returns status < 400

This means with `withX402`, if your handler throws an error or returns 500, the payment is not settled.

## Types and Exports

All necessary types are re-exported from the package:

```typescript
import type {
  PaymentRequired,
  PaymentRequirements,
  PaymentPayload,
  Network,
  RouteConfig,
  PaywallConfig,
  PaywallProvider,
} from "@x402/next";
```

## Production Considerations

### Environment Variables

Store sensitive configuration in environment variables:

```bash
FACILITATOR_URL=https://facilitator.example.com
EVM_PAYEE_ADDRESS=0x...
NEXT_PUBLIC_APP_NAME=MyApp
```

### Error Handling

Both approaches have built-in error handling:

- **Invalid payment headers** - Returns 402 with updated requirements
- **Facilitator connection issues** - Returns 502 with error details
- **Verification failures** - Returns 402 to retry

### Monitoring

Track payment events by monitoring:
- HTTP 402 responses (payment required)
- HTTP 201/200 with settlement headers (payment successful)
- HTTP 4xx/5xx with X-Payment-Error header (payment issues)

### Edge Runtime Compatibility

The Next.js adapter supports both Node.js and Edge Runtime:

```typescript
// For Node.js runtime (default)
export const runtime = "nodejs";

// For Edge Runtime (if supported by dependencies)
export const runtime = "edge";
```

Check that your scheme implementation supports your target runtime.

## Examples

### E-Commerce API

Protect a product detail endpoint:

```typescript
// app/api/products/[id]/route.ts
import { withX402 } from "@x402/next";
import { server } from "@/lib/x402-server";
import { NextRequest, NextResponse } from "next/server";

const handler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const product = await fetchProduct(params.id);

  return NextResponse.json({
    id: product.id,
    name: product.name,
    price: product.price,
    description: product.description,
    image: product.imageUrl,
  });
};

export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      payTo: process.env.PAYEE_ADDRESS,
      price: "$0.99",
      network: "eip155:8453",
    },
    description: "Unlock detailed product information",
  },
  server
);
```

### API Gateway Pattern

Protect all premium endpoints with middleware:

```typescript
// middleware.ts
import { paymentProxy } from "@x402/next";
import { server } from "@/lib/x402-server";

export const middleware = paymentProxy(
  {
    "/api/premium/*": {
      accepts: {
        scheme: "exact",
        payTo: process.env.PAYEE_ADDRESS,
        price: "$0.10",
        network: "eip155:8453",
      },
      description: "Premium API access",
    },
    "/api/enterprise/*": {
      accepts: {
        scheme: "exact",
        payTo: process.env.PAYEE_ADDRESS,
        price: "$1.00",
        network: "eip155:8453",
      },
      description: "Enterprise API access",
    },
  },
  server
);

export const config = {
  matcher: ["/api/premium/:path*", "/api/enterprise/:path*"],
};
```

## Troubleshooting

### "Facilitator URL is required"

Ensure `FACILITATOR_URL` environment variable is set and accessible.

### "Route does not match any configured pattern"

Check that your middleware `matcher` includes your route paths:

```typescript
export const config = {
  matcher: [
    "/api/protected",      // Exact match
    "/api/premium/:path*", // Wildcard match
  ],
};
```

### Payment verification failing

1. Verify facilitator is running and accessible
2. Check that payment scheme is properly registered with server
3. Confirm network parameter matches expected blockchain network

### Paywall UI not showing

1. Ensure `paywallConfig` is passed to `paymentProxy` or `withX402`
2. Check that `@x402/paywall` package is installed (optional but recommended)
3. Verify request is from a browser (paywall is HTML/browser-only)

## See Also

- [Core Package Documentation](../../../01-overview/packages.md#core) - Core types and concepts
- [EVM Scheme Documentation](../mechanisms/evm.md) - EVM blockchain support
- [SVM Scheme Documentation](../mechanisms/svm.md) - Solana support
- [Payment Flow](../../02-protocol-flows/payment-flow-overview.md) - Full protocol flow diagram
- [Express Integration](./express.md) - Express.js alternative
- [Hono Integration](./hono.md) - Hono framework alternative
