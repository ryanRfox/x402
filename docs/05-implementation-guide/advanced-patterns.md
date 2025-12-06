<!-- VERIFIED: d130db85 -->
# Advanced Patterns

This guide covers production-ready patterns for building sophisticated x402 applications. These patterns are demonstrated in the `examples/typescript/` directory.

> [!NOTE]
> All examples exclude `/legacy/` paths which contain V1 implementations. Only use non-legacy code for V2 patterns.

## Lifecycle Hooks

Lifecycle hooks allow you to inject custom logic at different stages of payment processing. Both clients and servers support hooks.

### Server Lifecycle Hooks

Register hooks on `x402ResourceServer` to intercept verification and settlement:

```typescript
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:84532", new ExactEvmScheme())

  // Called before payment verification
  .onBeforeVerify(async context => {
    console.log("Verifying payment for:", context.paymentRequirements.payTo);
    // Abort verification: return { abort: true, reason: "Not allowed" };
  })

  // Called after successful verification
  .onAfterVerify(async context => {
    console.log("Payment verified from:", context.result.payer);
    // Log to database, send metrics, etc.
  })

  // Called when verification fails
  .onVerifyFailure(async context => {
    console.error("Verification failed:", context.error);
    // Recover: return { recovered: true, result: { isValid: true } };
  })

  // Called before settlement
  .onBeforeSettle(async context => {
    console.log("Settling payment...");
    // Abort settlement: return { abort: true, reason: "Settlement paused" };
  })

  // Called after successful settlement
  .onAfterSettle(async context => {
    console.log("Settlement tx:", context.result.transaction);
    // Update database, send notifications, etc.
  })

  // Called when settlement fails
  .onSettleFailure(async context => {
    console.error("Settlement failed:", context.error);
    // Recover: return { recovered: true, result: { success: true, transaction: "0x..." } };
  });
```

**Hook Capabilities:**

| Hook | Can Abort | Can Recover | Use Case |
|------|-----------|-------------|----------|
| `onBeforeVerify` | Yes | No | Pre-validation, rate limiting |
| `onAfterVerify` | No | No | Logging, metrics |
| `onVerifyFailure` | No | Yes | Error recovery |
| `onBeforeSettle` | Yes | No | Final validation |
| `onAfterSettle` | No | No | Logging, notifications |
| `onSettleFailure` | No | Yes | Error recovery, retry |

### Client Lifecycle Hooks

Register hooks on `x402Client` to intercept payment creation:

```typescript
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(privateKey);

const client = new x402Client()
  .register("eip155:*", new ExactEvmScheme(signer))

  // Called before payment creation
  .onBeforePaymentCreation(async context => {
    console.log("Creating payment for network:", context.selectedRequirements.network);
    // Abort: return { abort: true, reason: "Payment not allowed" };
  })

  // Called after successful payment creation
  .onAfterPaymentCreation(async context => {
    console.log("Payment created, version:", context.paymentPayload.x402Version);
    // Send to analytics, log to database
  })

  // Called when payment creation fails
  .onPaymentCreationFailure(async context => {
    console.error("Payment creation failed:", context.error);
    // Recover: return { recovered: true, payload: alternativePayload };
  });
```

**Source:** `examples/typescript/clients/advanced/hooks.ts`

## Dynamic Configuration

Route configuration can use functions instead of static values for runtime resolution.

### Dynamic Pricing

Set prices based on request context (query params, headers, user tier):

```typescript
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532",
          payTo: evmAddress,
          // Dynamic price based on query parameter
          price: context => {
            const tier = context.adapter.getQueryParam?.("tier") ?? "standard";
            return tier === "premium" ? "$0.005" : "$0.001";
          },
        },
        description: "Weather data with tiered pricing",
      },
    },
    new x402ResourceServer(facilitatorClient).register("eip155:84532", new ExactEvmScheme()),
  ),
);

// Premium tier: GET /weather?tier=premium -> $0.005
// Standard tier: GET /weather?tier=standard -> $0.001
```

**Use Cases:**
- Tiered pricing (free/standard/premium)
- User-based pricing (authenticated vs anonymous)
- Volume-based pricing
- Time-based pricing (peak hours)

**Source:** `examples/typescript/servers/advanced/dynamic-price.ts`

### Dynamic PayTo (Marketplace Routing)

Route payments to different recipients based on request context:

```typescript
const addressLookup: Record<string, `0x${string}`> = {
  US: "0x1111...",  // US vendor
  UK: "0x2222...",  // UK vendor
  EU: "0x3333...",  // EU vendor
};

app.use(
  paymentMiddleware(
    {
      "GET /product/:id": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532",
          price: "$0.001",
          // Dynamic payTo based on query parameter
          payTo: context => {
            const region = context.adapter.getQueryParam?.("region") ?? "US";
            return addressLookup[region] ?? addressLookup.US;
          },
        },
        description: "Product data with regional routing",
      },
    },
    resourceServer,
  ),
);

// GET /product/123?region=UK -> pays UK vendor
// GET /product/123?region=EU -> pays EU vendor
```

**Use Cases:**
- Marketplace applications (pay sellers directly)
- Regional routing (different payment recipients per region)
- Multi-tenant SaaS (pay tenant owners)
- Affiliate/referral systems

**Source:** `examples/typescript/servers/advanced/dynamic-pay-to.ts`

## HTTP Adapter

The `context.adapter` object provides access to HTTP request details. It implements the `HTTPAdapter` interface:

```typescript
interface HTTPAdapter {
  getHeader(name: string): string | undefined;
  getMethod(): string;
  getPath(): string;
  getUrl(): string;
  getAcceptHeader(): string;
  getUserAgent(): string;
  getQueryParams?(): Record<string, string | string[]>;
  getQueryParam?(name: string): string | string[] | undefined;
  getBody?(): unknown;
}
```

Available in dynamic `price` and `payTo` functions:

```typescript
price: context => {
  // Access query parameters
  const tier = context.adapter.getQueryParam?.("tier");

  // Access headers (e.g., authentication)
  const authHeader = context.adapter.getHeader("authorization");

  // Access request path and method
  const path = context.adapter.getPath();
  const method = context.adapter.getMethod();

  // Return price based on context
  return calculatePrice(tier, authHeader);
}
```

## Registration Patterns

Two equivalent patterns for registering payment schemes:

### Helper Function Pattern

```typescript
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);
```

### Method Chaining Pattern

```typescript
import { ExactEvmScheme } from "@x402/evm/exact/server";

const server = new x402ResourceServer(facilitatorClient)
  .register("eip155:84532", new ExactEvmScheme());
```

Both patterns are valid. Helper functions are simpler; method chaining allows more control and hook registration in a single chain.

## Error Recovery Strategies

Implement intelligent error recovery in failure hooks:

```typescript
.onPaymentCreationFailure(async context => {
  const errorType = classifyError(context.error);

  switch (errorType) {
    case "network":
      // Let client retry automatically
      return undefined;

    case "insufficient_balance":
      // Alert user, no recovery possible
      notifyUser("Insufficient balance");
      return undefined;

    case "signing_error":
      // Attempt recovery with alternative method
      const alternativePayload = await createAlternativePayment(context);
      return { recovered: true, payload: alternativePayload };
  }
})
```

## Best Practices

### Hook Guidelines

1. **Keep hooks fast** - Avoid blocking operations
2. **Handle errors gracefully** - Don't throw in hooks
3. **Use structured logging** - Log contextual information
4. **Avoid side effects in before hooks** - Only use for validation
5. **Make after hooks idempotent** - They may run multiple times

### Dynamic Configuration Guidelines

1. **Validate inputs** - Check query params/headers exist
2. **Provide defaults** - Handle missing context gracefully
3. **Cache lookups** - Don't hit database on every request
4. **Log decisions** - Track which price/recipient was selected

## Source Code

All advanced patterns are available in the repository:

```
examples/typescript/
├── servers/advanced/
│   ├── hooks.ts                    # Server lifecycle hooks
│   ├── dynamic-price.ts            # Dynamic pricing
│   ├── dynamic-pay-to.ts           # Marketplace routing
│   ├── custom-money-definition.ts  # Custom tokens
│   └── bazaar.ts                   # Bazaar discovery
└── clients/advanced/
    ├── hooks.ts                    # Client lifecycle hooks
    └── preferred-network.ts        # Network selection
```

## Next Steps

- [Payment Schemes](./payment-schemes.md) - Custom payment scheme implementation
- [Types and Interfaces](./types-and-interfaces.md) - Complete type reference
- [Reference Implementation](../04-reference-implementation/README.md) - E2E examples
