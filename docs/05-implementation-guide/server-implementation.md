<!-- VERIFIED: 0aa62c64 -->
# Server Implementation

This guide explains how to build custom resource servers or extend the existing server implementation.

## Overview

The `x402ResourceServer` class manages payment verification and settlement by coordinating with a facilitator. It builds payment requirements based on route configuration and validates incoming payments.

```mermaid
flowchart LR
    Request[HTTP Request] --> Middleware[Payment Middleware]
    Middleware --> Server[x402ResourceServer]
    Server --> Facilitator[FacilitatorClient]
    Facilitator --> External[Facilitator Service]
```

## Key Interfaces

### SchemeNetworkServer

Every payment scheme must implement this interface for server-side operations:

```typescript
interface SchemeNetworkServer {
  readonly scheme: string;

  parsePrice(price: Price, network: Network): Promise<AssetAmount>;

  enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: SupportedKind,
    facilitatorExtensions: string[],
  ): Promise<PaymentRequirements>;
}
```

### ResourceConfig

Configuration for a protected resource:

```typescript
interface ResourceConfig {
  scheme: string;
  payTo: string;
  price: Price;
  network: Network;
  maxTimeoutSeconds?: number;
}
```

### x402ResourceServer Methods

```typescript
class x402ResourceServer {
  // Register a scheme for a network
  register(network: Network, server: SchemeNetworkServer): x402ResourceServer;

  // Register a protocol extension
  registerExtension(extension: ResourceServerExtension): x402ResourceServer;

  // Initialize by fetching supported kinds from facilitators
  initialize(): Promise<void>;

  // Build payment requirements from configuration
  buildPaymentRequirements(config: ResourceConfig): Promise<PaymentRequirements[]>;

  // Create a 402 response
  createPaymentRequiredResponse(
    requirements: PaymentRequirements[],
    resourceInfo: ResourceInfo,
    error?: string,
    extensions?: Record<string, unknown>,
  ): PaymentRequired;

  // Verify a payment payload
  verifyPayment(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;

  // Settle a verified payment
  settlePayment(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
}
```

## Implementation Steps

### 1. Create Facilitator Client

```typescript
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://facilitator.x402.org",
});
```

### 2. Create Resource Server

```typescript
import { x402ResourceServer } from "@x402/core/server";

const server = new x402ResourceServer(facilitatorClient);
```

### 3. Register Payment Schemes

```typescript
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";

registerExactEvmScheme(server);
registerExactSvmScheme(server);
```

### 4. Initialize Server

Initialize to fetch supported kinds from the facilitator:

```typescript
await server.initialize();
```

### 5. Configure Routes

Use the payment middleware with route configuration:

```typescript
import { paymentMiddleware } from "@x402/express";

app.use(paymentMiddleware({
  "GET /protected": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: process.env.EVM_PAYEE_ADDRESS,
      price: "$0.001",
    },
  },
}, server));
```

## Route Configuration

### Single Payment Option

```typescript
"GET /api/resource": {
  accepts: {
    scheme: "exact",
    network: "eip155:84532",
    payTo: "0x...",
    price: "$0.001",
  },
  description: "Access to premium resource",
}
```

### Multiple Payment Options

```typescript
"GET /api/resource": {
  accepts: [
    {
      scheme: "exact",
      network: "eip155:84532",
      payTo: evmAddress,
      price: "$0.001",
    },
    {
      scheme: "exact",
      network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      payTo: solanaAddress,
      price: "$0.001",
    },
  ],
}
```

### Dynamic Pricing

```typescript
"GET /api/resource/:id": {
  accepts: {
    scheme: "exact",
    network: "eip155:84532",
    payTo: "0x...",
    price: async (req) => {
      const resource = await getResource(req.params.id);
      return resource.price;
    },
  },
}
```

### Dynamic Recipient

```typescript
"GET /api/creator/:id/content": {
  accepts: {
    scheme: "exact",
    network: "eip155:84532",
    payTo: async (req) => {
      const creator = await getCreator(req.params.id);
      return creator.walletAddress;
    },
    price: "$0.001",
  },
}
```

## Lifecycle Hooks

### Verify Hooks

```typescript
server.onBeforeVerify(async (context) => {
  console.log("Verifying payment:", context.paymentPayload);

  // Abort verification
  if (isBanned(context.paymentPayload.payload.from)) {
    return { abort: true, reason: "Payer is banned" };
  }
});

server.onAfterVerify(async (context) => {
  console.log("Verified:", context.result.isValid);
  await logVerification(context);
});

server.onVerifyFailure(async (context) => {
  console.error("Verification failed:", context.error);

  // Attempt recovery
  if (canRecover(context)) {
    return { recovered: true, result: { isValid: true, payer: "0x..." } };
  }
});
```

### Settle Hooks

```typescript
server.onBeforeSettle(async (context) => {
  console.log("Settling payment...");

  // Abort settlement
  if (alreadySettled(context.paymentPayload)) {
    return { abort: true, reason: "Already settled" };
  }
});

server.onAfterSettle(async (context) => {
  console.log("Settled:", context.result.transaction);
  await recordSettlement(context);
});

server.onSettleFailure(async (context) => {
  console.error("Settlement failed:", context.error);
  await alertOnFailure(context);
});
```

## Extensions

### Register Extensions

```typescript
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";

server.registerExtension(bazaarResourceServerExtension);
```

### Declare Extension Metadata

```typescript
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

"GET /api/weather": {
  accepts: { /* ... */ },
  extensions: {
    ...declareDiscoveryExtension({
      output: {
        example: { temperature: 72, unit: "F" },
        schema: {
          type: "object",
          properties: {
            temperature: { type: "number" },
            unit: { type: "string" },
          },
        },
      },
    }),
  },
}
```

## Custom Middleware Integration

### Generic Pattern

```typescript
async function handlePaymentRequired(
  request: Request,
  resourceConfig: ResourceConfig,
  resourceInfo: ResourceInfo,
): Promise<Response | null> {
  // Check for payment header
  const paymentHeader = request.headers.get("PAYMENT-SIGNATURE");

  if (!paymentHeader) {
    // No payment - return 402
    const requirements = await server.buildPaymentRequirements(resourceConfig);
    const paymentRequired = server.createPaymentRequiredResponse(
      requirements,
      resourceInfo,
      "Payment required",
    );

    return new Response(null, {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": btoa(JSON.stringify(paymentRequired)),
      },
    });
  }

  // Parse and verify payment
  const paymentPayload: PaymentPayload = JSON.parse(atob(paymentHeader));
  const requirements = await server.buildPaymentRequirements(resourceConfig);
  const matching = server.findMatchingRequirements(requirements, paymentPayload);

  if (!matching) {
    return new Response("Invalid payment requirements", { status: 402 });
  }

  const verification = await server.verifyPayment(paymentPayload, matching);

  if (!verification.isValid) {
    return new Response(verification.invalidReason, { status: 402 });
  }

  // Payment verified - proceed to handler and settle after
  return null; // Allow request to proceed
}
```

### Post-Response Settlement

```typescript
async function settleAfterResponse(
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<void> {
  try {
    const result = await server.settlePayment(paymentPayload, requirements);
    console.log("Settled:", result.transaction);
  } catch (error) {
    console.error("Settlement failed:", error);
    // Handle settlement failure (retry queue, alerts, etc.)
  }
}
```

## Multiple Facilitators

Support multiple facilitators for redundancy:

```typescript
const server = new x402ResourceServer([
  new HTTPFacilitatorClient({ url: "https://facilitator1.example.com" }),
  new HTTPFacilitatorClient({ url: "https://facilitator2.example.com" }),
]);
```

Earlier facilitators in the array get precedence.

## Error Handling

```typescript
try {
  await server.verifyPayment(payload, requirements);
} catch (error) {
  if (error.message.includes("No facilitator supports")) {
    // Unsupported network/scheme combination
  } else if (error.message.includes("initialize()")) {
    // Server not initialized
  }
}
```

## Next Steps

- [Facilitator Implementation](./facilitator-implementation.md) - Building facilitators
- [Payment Schemes](./payment-schemes.md) - Creating custom schemes
- [Types and Interfaces](./types-and-interfaces.md) - Complete type reference
