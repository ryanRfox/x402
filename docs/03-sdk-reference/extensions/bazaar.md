<!-- VERIFIED: 3c3e2168 -->
# Bazaar Extension

The Bazaar extension enables service discovery for x402-protected APIs. It allows resource servers to declare metadata about their payment-protected endpoints, and facilitators to extract and catalog this metadata for client discovery.

## Overview

Bazaar solves the discoverability problem in paid APIs. When protecting an endpoint with x402, clients need to know:

- What input parameters are required
- What output format to expect
- How much the endpoint costs
- Which blockchain networks are accepted
- What payment address to send funds to

Rather than requiring clients to read API documentation or maintain client-side configuration, Bazaar embeds this discovery metadata directly in the payment requirements. This allows facilitators to automatically catalog endpoints and provide clients with structured information about available services.

> [!NOTE]
> **Roadmap: Bazaar Enhancements**
> Several Bazaar extensions are planned:
> - **External Facilitator Endpoints** - Third-party facilitator registration (Q4 2025)
> - **A2A Support** - Agent-to-Agent discovery and execution (Q4/Q1 2026)
> - **MCP Support** - MCP tool discovery alongside endpoints (Q4/Q1 2026)
> - **ERC-8004 Integration** - Trustless Agents standard (Q1-Q2 2026)
> - **Search and Categorization** - Search, categories, and ranking (TBD)
>
> [View Roadmap](../../09-appendix/roadmap.md#next-queued)

## Use Cases

- **API Marketplaces**: Catalog thousands of paid endpoints without manual registration
- **Dynamic Client Configuration**: Let clients discover payment terms and data schemas at runtime
- **Service Aggregation**: Build platforms that consume multiple paid APIs and route requests intelligently
- **OpenAPI Integration**: Bridge between traditional API documentation and x402 payment metadata

## Installation

The Bazaar extension is included in the `@x402/extensions` package:

```bash
npm install @x402/extensions
```

## Server-Side Integration

Use Bazaar on a resource server to declare discovery metadata for payment-protected endpoints.

### Basic Setup

Import the extension and register it with your x402 server:

```typescript
import express from "express";
import { x402ResourceServer, paymentMiddleware } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/mechanisms/evm";
import { bazaarResourceServerExtension, declareDiscoveryExtension, BAZAAR } from "@x402/extensions/bazaar";

// Initialize server
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

// Register Bazaar extension
server.registerExtension(bazaarResourceServerExtension);

// Create Express app
const app = express();
```

### Declaring Discovery Metadata

When defining payment-protected routes, include discovery information in the extensions:

```typescript
app.use(
  paymentMiddleware(
    {
      "GET /api/data": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532",
          payTo: "0x742d35Cc6634C0532925a3b844Bc39e4eAd6F9a2",
          price: "$0.001",
        },
        description: "Fetch protected data with custom query parameters",
        extensions: {
          [BAZAAR]: declareDiscoveryExtension({
            method: "GET",
            input: {
              query: "The search query string",
            },
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search term to filter results",
                },
              },
              required: ["query"],
            },
            output: {
              example: {
                success: true,
                data: [
                  { id: 1, name: "Result 1" },
                  { id: 2, name: "Result 2" },
                ],
              },
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "number" },
                        name: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
      },
      "POST /api/process": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532",
          payTo: "0x742d35Cc6634C0532925a3b844Bc39e4eAd6F9a2",
          price: "$0.05",
        },
        description: "Process data with JSON payload",
        extensions: {
          [BAZAAR]: declareDiscoveryExtension({
            method: "POST",
            bodyType: "json",
            input: {
              file: "Base64-encoded file content",
              options: "Processing options",
            },
            inputSchema: {
              type: "object",
              properties: {
                file: {
                  type: "string",
                  format: "base64",
                  description: "Base64-encoded file to process",
                },
                options: {
                  type: "object",
                  properties: {
                    format: {
                      type: "string",
                      enum: ["json", "csv", "xml"],
                    },
                  },
                },
              },
              required: ["file"],
            },
            output: {
              example: {
                processed: true,
                resultUrl: "https://api.example.com/results/abc123",
              },
              schema: {
                type: "object",
                properties: {
                  processed: { type: "boolean" },
                  resultUrl: { type: "string", format: "uri" },
                },
              },
            },
          }),
        },
      },
    },
    server
  )
);
```

### Discovery Extension API

The `declareDiscoveryExtension` function accepts the following parameters:

```typescript
interface DiscoveryExtensionOptions {
  method: "GET" | "HEAD" | "DELETE" | "POST" | "PUT" | "PATCH";
  bodyType?: "json" | "form-data" | "text"; // Required for POST/PUT/PATCH
  input?: Record<string, string | object>;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
  queryParams?: Record<string, string | object>;
  headers?: Record<string, string>;
  output?: {
    example?: unknown;
    schema?: {
      type?: string;
      properties?: Record<string, unknown>;
      items?: unknown;
      [key: string]: unknown;
    };
    format?: string;
  };
}
```

## Facilitator-Side Integration

Use Bazaar on the facilitator to extract and validate discovery metadata from payment payloads.

### Extracting Discovery Information

When a client makes a payment for an x402-protected endpoint, the facilitator can extract discovery metadata:

```typescript
import { extractDiscoveryInfo, validateDiscoveryExtension, BAZAAR } from "@x402/extensions/bazaar";

// Within facilitator payment processing
async function processPaymentWithDiscovery(paymentPayload, paymentRequirements) {
  // Verify the payment first
  const verification = await facilitator.verify(paymentPayload, paymentRequirements);

  if (!verification.isValid) {
    return { success: false, error: "Payment verification failed" };
  }

  // Extract discovery metadata if present
  const discoveryInfo = extractDiscoveryInfo(paymentPayload, paymentRequirements);

  if (discoveryInfo) {
    // Store in catalog or index service
    await catalogService.add({
      endpoint: paymentRequirements.resource,
      network: paymentRequirements.scheme.network,
      payTo: paymentRequirements.scheme.payTo,
      price: paymentRequirements.scheme.price,
      discovery: discoveryInfo,
    });

    console.log("Cataloged endpoint with discovery metadata:", {
      inputSchema: discoveryInfo.input,
      outputSchema: discoveryInfo.output,
    });
  }

  // Proceed with settlement
  return await facilitator.settle(paymentPayload, paymentRequirements);
}
```

### Validating Discovery Extensions

Before using discovery metadata, validate its structure:

```typescript
import { validateDiscoveryExtension, BAZAAR } from "@x402/extensions/bazaar";

function processPaymentExtensions(paymentPayload) {
  const bazaarExtension = paymentPayload.extensions?.[BAZAAR];

  if (bazaarExtension) {
    const validation = validateDiscoveryExtension(bazaarExtension);

    if (validation.valid) {
      console.log("Discovery extension is valid");
      // Use the discovery metadata
      return bazaarExtension;
    } else {
      console.error("Discovery extension validation failed:", validation.errors);
      // Handle invalid metadata - either reject or proceed without discovery
    }
  }

  return null;
}
```

## Discovery Info Structure

The discovery information extracted from Bazaar extensions follows this structure:

### Query Endpoints (GET, HEAD, DELETE)

```typescript
interface QueryDiscoveryInfo {
  input: {
    type: "http";
    method: "GET" | "HEAD" | "DELETE";
    queryParams?: Record<string, unknown>;
    headers?: Record<string, string>;
  };
  output?: {
    type?: string;
    format?: string;
    example?: unknown;
  };
}
```

### Body Endpoints (POST, PUT, PATCH)

```typescript
interface BodyDiscoveryInfo {
  input: {
    type: "http";
    method: "POST" | "PUT" | "PATCH";
    bodyType: "json" | "form-data" | "text";
    body: Record<string, unknown>;
    queryParams?: Record<string, unknown>;
    headers?: Record<string, string>;
  };
  output?: {
    type?: string;
    format?: string;
    example?: unknown;
  };
}
```

## Complete Example

Here's a complete example of a resource server with Bazaar discovery:

```typescript
import express from "express";
import { x402ResourceServer, paymentMiddleware, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/mechanisms/evm";
import { bazaarResourceServerExtension, declareDiscoveryExtension, BAZAAR } from "@x402/extensions/bazaar";

// Setup
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org",
});

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);
server.registerExtension(bazaarResourceServerExtension);

const app = express();

// Middleware
app.use(express.json());

// Protected endpoints with discovery metadata
app.use(
  paymentMiddleware(
    {
      "GET /api/weather": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532",
          payTo: "0x742d35Cc6634C0532925a3b844Bc39e4eAd6F9a2",
          price: "$0.001",
        },
        extensions: {
          [BAZAAR]: declareDiscoveryExtension({
            method: "GET",
            input: {
              city: "City name to get weather for",
              units: "Temperature units (celsius or fahrenheit)",
            },
            inputSchema: {
              type: "object",
              properties: {
                city: {
                  type: "string",
                  description: "City name",
                },
                units: {
                  type: "string",
                  enum: ["celsius", "fahrenheit"],
                  default: "celsius",
                },
              },
              required: ["city"],
            },
            output: {
              example: {
                city: "San Francisco",
                temperature: 68,
                condition: "Partly Cloudy",
                units: "fahrenheit",
              },
              schema: {
                type: "object",
                properties: {
                  city: { type: "string" },
                  temperature: { type: "number" },
                  condition: { type: "string" },
                  units: { type: "string" },
                },
              },
            },
          }),
        },
      },
    },
    server
  )
);

// Route handler
app.get("/api/weather", async (req, res) => {
  const { city, units = "celsius" } = req.query;

  // Fetch weather data from external service
  const weatherData = {
    city,
    temperature: 22,
    condition: "Sunny",
    units,
  };

  res.json(weatherData);
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(3000, () => {
  console.log("Resource server running on http://localhost:3000");
});
```

## API Reference

### Server Exports

#### `BAZAAR`

Constant identifier for the Bazaar extension:

```typescript
export const BAZAAR = "bazaar";
```

Use this when referencing the Bazaar extension in payment requirements.

#### `declareDiscoveryExtension(options)`

Declares discovery metadata for a payment-protected endpoint.

**Parameters:**
- `options`: Discovery configuration object with `method`, `bodyType`, `input`, `inputSchema`, `output`, etc.

**Returns:** Formatted discovery extension object

#### `bazaarResourceServerExtension`

Extension object to register with the x402 resource server.

**Usage:**
```typescript
server.registerExtension(bazaarResourceServerExtension);
```

### Facilitator Exports

#### `extractDiscoveryInfo(paymentPayload, paymentRequirements)`

Extracts discovery metadata from a payment payload.

**Parameters:**
- `paymentPayload`: The x402 payment payload
- `paymentRequirements`: The payment requirements

**Returns:** `DiscoveryInfo | null` - Returns null if no valid Bazaar extension is present

**Example:**
```typescript
const info = extractDiscoveryInfo(paymentPayload, requirements);
if (info) {
  console.log("Endpoint discovery info:", info);
}
```

#### `validateDiscoveryExtension(extension)`

Validates the structure of a discovery extension.

**Parameters:**
- `extension`: The Bazaar extension object to validate

**Returns:** Validation result object with `valid: boolean` and optional `errors: string[]`

**Example:**
```typescript
const result = validateDiscoveryExtension(bazaarExtension);
if (result.valid) {
  // Safe to use the extension
} else {
  console.error("Invalid discovery extension:", result.errors);
}
```

## Related Documentation

- [Core Server Module](../core/server.md) - Payment verification and settlement
- [Core Facilitator Module](../core/facilitator.md) - Facilitator service operations
- [Payment Flows](../../02-protocol-flows/README.md) - How x402 payments work
