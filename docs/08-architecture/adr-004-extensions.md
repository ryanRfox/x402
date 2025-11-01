# ADR-004: Extension System Design

## Status

**Accepted** - October 2024

## Context

The x402 protocol provides core payment functionality, but real-world applications often need additional features:

- **Service Discovery**: How do clients find x402-enabled APIs?
- **Authentication**: How do payments integrate with identity?
- **Analytics**: How do servers track payment patterns?
- **Rate Limiting**: How do payments interact with usage quotas?
- **Multi-Signature**: How do enterprise payments work?
- **Subscriptions**: How do recurring payments work?
- **Refunds**: How are disputes handled?

### The Challenge

The core protocol must remain:
- **Simple**: Easy to understand and implement
- **Stable**: Breaking changes are costly
- **Minimal**: Focus on core payment flow
- **Interoperable**: Work across all implementations

But applications need:
- **Rich Features**: Beyond basic payments
- **Customization**: Domain-specific behaviors
- **Experimentation**: Try new ideas without protocol changes
- **Evolution**: Adapt to ecosystem needs

How do we support extensibility without compromising core simplicity?

### Alternative Approaches

#### Option 1: Build Everything Into Core

Add all features directly to the protocol:

```typescript
interface PaymentRequirements {
  // Core
  scheme: string;
  network: string;
  amount: string;

  // Extensions built-in
  discovery?: DiscoveryInfo;
  authentication?: AuthInfo;
  analytics?: AnalyticsInfo;
  rateLimit?: RateLimitInfo;
  subscription?: SubscriptionInfo;
  refund?: RefundInfo;
  // ... grows forever
}
```

**Rejected because**:
- Core protocol becomes bloated
- Every implementation must handle all features
- Breaking changes whenever features are added
- Impossible to experiment without forking protocol
- Optional features clutter required fields

#### Option 2: Versioned Protocol With Feature Flags

Add features through version negotiation:

```typescript
interface PaymentRequirements {
  x402Version: 2;
  features: ["discovery", "auth", "analytics"]; // Declare features
  // Feature data goes somewhere?
}
```

**Rejected because**:
- Unclear where feature data lives
- Version explosion (2.1, 2.2, 2.3 for each feature)
- Feature combinations create complexity (2^n combinations)
- Still requires core protocol changes for new features

#### Option 3: Extension Fields (Chosen)

Provide structured extension fields in core types:

```typescript
interface PaymentRequirements {
  // Core fields (stable)
  scheme: string;
  network: string;
  amount: string;
  payTo: string;

  // Extension point (unstable, experimental)
  extra: Record<string, any>;
  extensions?: Record<string, any>;
}
```

## Decision

**x402 V2 uses an extension system** with these principles:

### 1. Extension Fields in Core Types

All major protocol types include extension fields:

```typescript
// From: typescript/packages/core/src/types/payments.ts

export type PaymentRequirements = {
  scheme: string;
  network: Network;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, any>; // Scheme-specific extensions
}

export type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: PaymentRequirements[];
  extensions?: Record<string, any>; // Protocol extensions
}

export type PaymentPayload = {
  x402Version: number;
  scheme: string;
  network: Network;
  payload: Record<string, any>;
  accepted: PaymentRequirements;
  extensions?: Record<string, any>; // Client extensions
}
```

**Key Points**:
- `extra`: Scheme-specific data (e.g., EVM gas settings)
- `extensions`: Protocol-level features (e.g., discovery, auth)

### 2. Namespaced Extension Names

Extensions use reverse-domain naming to avoid conflicts:

```typescript
// Good: Namespaced
{
  "extensions": {
    "com.example.discovery": { ... },
    "com.coinbase.analytics": { ... },
    "org.x402.bazaar": { ... }
  }
}

// Bad: Conflicts possible
{
  "extensions": {
    "discovery": { ... }, // Whose discovery?
    "analytics": { ... }  // Whose analytics?
  }
}
```

**Convention**: Use domain names you control to guarantee uniqueness.

### 3. Two-Part Extension Structure

Extensions have `info` (data) and `schema` (validation):

```typescript
// From: typescript/packages/extensions/bazaar/src/index.ts

export interface DiscoveryExtension {
  // The actual data
  info: {
    input: {
      type: "http";
      method: "GET" | "POST" | ...;
      queryParams?: Record<string, any>;
      headers?: Record<string, string>;
    };
    output?: {
      type?: string;
      format?: string;
      example?: any;
    };
  };

  // JSON Schema for validation
  schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema";
    type: "object";
    properties: {
      input: { ... };
      output?: { ... };
    };
    required: ["input"];
  };
}
```

**Benefits**:
- **info**: Machine-readable data for processing
- **schema**: Self-documenting structure
- Clients can validate extensions
- Type-safe extension development

### 4. Optional and Ignored

Extensions are always optional:

```typescript
// Server includes extension
const paymentRequired: PaymentRequired = {
  x402Version: 2,
  accepts: [...],
  extensions: {
    "org.x402.bazaar": discoveryExtension
  }
};

// Client doesn't understand it - no problem!
// Client ignores unknown extensions and pays normally
const payment = await client.createPayment(paymentRequired.accepts[0]);
// payment.extensions is empty or undefined
```

**Principle**: Unknown extensions MUST be ignored, never cause errors.

### 5. Extension Packages

Extensions are distributed as separate npm packages:

```bash
# Core protocol
npm install @x402/core

# Optional extensions
npm install @x402/extensions/bazaar          # Discovery
npm install @x402/extensions/sign-in-with-x  # Authentication
npm install @x402/analytics       # (hypothetical)
```

**Benefits**:
- Pay-for-what-you-use (smaller bundles)
- Independent versioning
- Community contributions
- Clear dependency boundaries

## Consequences

### Positive Consequences

#### 1. Core Protocol Stability

Core types don't change when extensions are added:

```typescript
// v2.0 (2024)
interface PaymentRequirements {
  scheme: string;
  network: Network;
  extensions?: Record<string, any>; // Stable!
}

// v2.0 (2025) - Same structure!
interface PaymentRequirements {
  scheme: string;
  network: Network;
  extensions?: Record<string, any>; // New extensions used, not new fields
}
```

**Benefits**:
- Implementations don't break
- Protocol version stays stable
- Backward compatibility maintained
- Ecosystem grows without fragmentation

#### 2. Experimentation Without Risk

Try new features without protocol changes:

```typescript
// Experiment: Add refund capability
app.use(paymentMiddleware(
  {
    "GET /protected": {
      payTo: "0x...",
      scheme: "exact",
      price: "$0.001",
      network: "eip155:8453",
      extensions: {
        "com.example.refunds": {
          info: {
            refundable: true,
            refundWindow: 3600, // 1 hour
            refundPolicy: "https://example.com/refund-policy"
          }
        }
      }
    }
  },
  facilitator,
  schemes
));

// If it doesn't work, remove it - no protocol impact
```

#### 3. Domain-Specific Features

Enterprises can add custom features:

```typescript
// Enterprise multi-signature extension
interface MultiSigExtension {
  info: {
    requiredSignatures: number;
    signers: string[];
    threshold: number;
    approvalWorkflow: string;
  };
  schema: { ... };
}

// Used internally without affecting public protocol
const requirements: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:8453",
  extensions: {
    "com.acme.multisig": multiSigExtension
  }
};
```

**Use Cases**:
- Enterprise approval workflows
- Compliance requirements
- Industry-specific standards
- Internal tooling

#### 4. Graceful Degradation

Clients work even if they don't support extensions:

```typescript
// Advanced server with discovery
app.use(paymentMiddleware({
  "GET /api/data": {
    scheme: "exact",
    network: "eip155:8453",
    extensions: {
      "org.x402.bazaar": discoveryExtension // Advanced feature
    }
  }
}));

// Simple client without discovery support
const client = wrapFetchWithPayment(fetch, {
  schemes: [{ network: "eip155:*", client: new ExactEvmClient(account) }]
  // No discovery extension configured
});

// Still works! Client ignores discovery extension
const response = await client(url);
```

#### 5. Community Innovation

Anyone can create extensions:

```bash
# Community member creates new extension
mkdir my-x402-extension
npm init @x402/my-extension

# Publish to npm
npm publish

# Others can use it
npm install @x402/my-extension
```

**Examples**:
- Rate limiting integrations
- Analytics providers
- Authentication methods
- Payment schemes
- Discovery mechanisms

#### 6. Documentation Through Schema

Extensions are self-documenting:

```typescript
// From: @x402/extensions/bazaar
export function declareDiscoveryExtension(
  method: "GET" | "POST" | ...,
  input: any,
  inputSchema: Record<string, any>,
  options?: {
    output?: {
      example?: any;
      schema?: Record<string, any>;
    };
  }
): DiscoveryExtension {
  return {
    info: {
      input: { type: "http", method, queryParams: input },
      output: options?.output
    },
    schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        input: {
          type: "object",
          properties: {
            type: { type: "string", const: "http" },
            method: { type: "string", enum: [method] },
            queryParams: inputSchema
          },
          required: ["type", "method"]
        }
      }
    }
  };
}

// Usage is self-documenting
const extension = declareDiscoveryExtension(
  "GET",
  { userId: "123", format: "json" }, // Example input
  {
    properties: {
      userId: { type: "string", description: "User ID" },
      format: { type: "string", enum: ["json", "xml"] }
    },
    required: ["userId"]
  }
);
```

Schema makes the extension understandable without external documentation.

### Negative Consequences

#### 1. Extension Discovery Challenge

Clients don't automatically know what extensions exist:

**Problem**: How does a client learn about available extensions?

**Mitigations**:

1. **Documentation**: List known extensions in docs
2. **Discovery endpoint**: Server advertises extensions
3. **Well-known extensions**: Standard extensions documented
4. **Extension registry**: Community-maintained list

```typescript
// Server advertises extensions via OPTIONS
app.options('/api/*', (req, res) => {
  res.json({
    x402: {
      version: 2,
      extensions: [
        "org.x402.bazaar",
        "org.x402.sign-in-with-x"
      ]
    }
  });
});

// Client queries capabilities
const capabilities = await fetch(url, { method: 'OPTIONS' });
const extensions = await capabilities.json();
```

#### 2. Namespace Collisions

Without discipline, namespace collisions occur:

**Problem**:
```typescript
// Both try to use "discovery"
extensions: {
  "discovery": { /* Company A */ },
  "discovery": { /* Company B */ } // Overwrites!
}
```

**Mitigation**:
- Require reverse-domain naming
- Lint rules enforce namespacing
- Documentation emphasizes naming conventions
- Well-known extensions reserve short names

```typescript
// Well-known extensions (reserved)
"org.x402.bazaar"           // Official discovery
"org.x402.sign-in-with-x"   // Official auth

// Third-party extensions (must namespace)
"com.stripe.payments"
"com.coinbase.analytics"
"dev.yourname.custom"
```

#### 3. Validation Complexity

Extensions may have invalid data:

**Problem**: `extensions` is `Record<string, any>`, so anything goes.

**Mitigation**:
- Provide validation utilities
- Extensions include schemas
- Strict mode for development
- Ignore invalid extensions in production

```typescript
import Ajv from 'ajv';

function validateExtension(
  extensionData: any,
  extensionSchema: any
): boolean {
  const ajv = new Ajv();
  const validate = ajv.compile(extensionSchema);
  return validate(extensionData);
}

// In development: Throw on invalid
if (process.env.NODE_ENV === 'development') {
  if (!validateExtension(ext.info, ext.schema)) {
    throw new Error('Invalid extension data');
  }
}

// In production: Ignore invalid
if (!validateExtension(ext.info, ext.schema)) {
  console.warn('Ignoring invalid extension');
  delete paymentRequired.extensions[key];
}
```

#### 4. Implementation Fragmentation

Different implementations support different extensions:

**Challenge**:
- Implementation A supports extensions X, Y
- Implementation B supports extensions Y, Z
- Clients must handle varying support

**Mitigation**:
- Core protocol works without extensions (fallback)
- Clients check for extension support before using
- Documentation lists implementation support

```typescript
// Check extension support before using
async function supportsExtension(
  url: string,
  extensionName: string
): Promise<boolean> {
  const response = await fetch(url, { method: 'OPTIONS' });
  const capabilities = await response.json();
  return capabilities.x402?.extensions?.includes(extensionName);
}

// Use extension conditionally
if (await supportsExtension(url, 'org.x402.bazaar')) {
  // Use discovery features
} else {
  // Fall back to basic payment
}
```

#### 5. Documentation Burden

Each extension needs documentation:

**Challenge**: Extensions aren't automatically understood.

**Mitigation**:
- Standard extension template
- Schema provides inline docs
- Example code in packages
- Centralized extension registry

```typescript
// Extension package structure
@x402/my-extension/
├── README.md          // Human-readable docs
├── src/
│   ├── index.ts      // Extension implementation
│   └── schema.ts     // JSON Schema
├── examples/
│   ├── client.ts     // Client usage
│   └── server.ts     // Server usage
└── package.json
```

## Extension Examples

### 1. Discovery Extension (Bazaar)

Enable facilitators to catalog x402-enabled resources:

```typescript
// From: @x402/extensions/bazaar
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

// Server declares API structure
app.use(paymentMiddleware({
  "GET /weather": {
    scheme: "exact",
    network: "eip155:8453",
    price: "$0.001",
    extensions: {
      "org.x402.bazaar": declareDiscoveryExtension(
        "GET",
        { city: "San Francisco", unit: "celsius" }, // Example
        {
          properties: {
            city: { type: "string", description: "City name" },
            unit: { type: "string", enum: ["celsius", "fahrenheit"] }
          },
          required: ["city"]
        },
        {
          output: {
            example: {
              temperature: 15,
              condition: "sunny",
              humidity: 65
            }
          }
        }
      )
    }
  }
}));

// Facilitator indexes this information
// Clients can discover: "What weather APIs accept payments?"
```

**Use Cases**:
- API marketplaces
- Service discovery
- Automatic integration
- API documentation generation

### 2. Authentication Extension (Sign-in-with-X)

Link payments to authenticated sessions:

```typescript
// From: @x402/extensions/sign-in-with-x (hypothetical implementation)
app.use(paymentMiddleware({
  "GET /private-data": {
    scheme: "exact",
    network: "eip155:8453",
    price: "$0.01",
    extensions: {
      "org.x402.sign-in-with-x": {
        info: {
          required: true,
          sessionDuration: 3600,
          publicKey: "0x..."
        },
        schema: {
          type: "object",
          properties: {
            required: { type: "boolean" },
            sessionDuration: { type: "number" },
            publicKey: { type: "string" }
          }
        }
      }
    }
  }
}));

// Client provides both payment and authentication
const payment = await client.createPayment(requirements, {
  extensions: {
    "org.x402.sign-in-with-x": {
      signature: signedMessage,
      timestamp: Date.now()
    }
  }
});
```

**Use Cases**:
- Personalized content
- User accounts
- Access control
- Compliance (KYC/AML)

### 3. Rate Limiting Extension

Communicate rate limit information:

```typescript
// Custom extension
app.use(paymentMiddleware({
  "GET /api/search": {
    scheme: "exact",
    network: "eip155:8453",
    price: "$0.001",
    extensions: {
      "com.example.rate-limit": {
        info: {
          requests: 100,
          window: 3600,
          cost: "$0.10" // Total cost per window
        }
      }
    }
  }
}));

// Server includes rate limit status in response
res.setHeader('Payment-Response', encodePaymentResponseHeader({
  success: true,
  transactionHash: "0x...",
  extensions: {
    "com.example.rate-limit": {
      remaining: 95,
      resetAt: 1634567890
    }
  }
}));
```

**Use Cases**:
- Usage quotas
- Burst protection
- Fair access
- Cost predictability

## Guidelines for Creating Extensions

### 1. Namespace Your Extension

Use reverse-domain notation:

```typescript
// Good
"com.yourcompany.feature"
"org.yourorg.tool"
"dev.yourname.experiment"

// Bad
"feature"     // Collision risk
"my-tool"     // Not namespaced
```

### 2. Include Schema

Always provide JSON Schema for validation:

```typescript
const myExtension = {
  info: { /* data */ },
  schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: { /* structure */ },
    required: [ /* fields */ ]
  }
};
```

### 3. Make It Optional

Never break core flow if extension is missing:

```typescript
// Good: Works without extension
const payment = createPayment(requirements);

// Bad: Throws if extension missing
const payment = createPayment(requirements);
if (!payment.extensions['my-ext']) {
  throw new Error('Extension required!'); // Bad!
}
```

### 4. Document Thoroughly

Provide clear documentation:
- Purpose and use cases
- Integration examples (client and server)
- Schema reference
- Security considerations
- Performance impact

### 5. Version Your Extension

Extensions can evolve:

```typescript
{
  "com.example.feature": {
    version: "1.0.0",
    info: { /* v1 data */ }
  }
}

// Later
{
  "com.example.feature": {
    version: "2.0.0",
    info: { /* v2 data */ }
  }
}
```

## Related Decisions

- [ADR-001: Header-Based Protocol](./adr-001-header-based.md) - Extensions fit in headers
- [ADR-002: Facilitator Abstraction](./adr-002-facilitator.md) - Extensions in facilitator responses
- [ADR-003: Multi-Network Architecture](./adr-003-multi-network.md) - Network-specific extensions

## References

- [JSON Schema Specification](https://json-schema.org/)
- Discovery Extension: `typescript/packages/extensions/bazaar/`
- Extension Field: `typescript/packages/core/src/types/payments.ts`
- [Semantic Versioning](https://semver.org/)

---

*This ADR explains how x402 achieves extensibility without complexity.*
