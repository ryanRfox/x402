# ADR-001: Header-Based Protocol Design

## Status

**Accepted** - October 2024

## Context

The x402 protocol enables HTTP endpoints to require micropayments for access. A fundamental design decision is where to place payment-related information in HTTP requests and responses. There are two primary approaches:

### Option 1: Body-Based Protocol

Payment information could be embedded in the request and response bodies:

```http
POST /api/data
Content-Type: application/json

{
  "payment": {
    "signature": "0x...",
    "network": "eip155:8453",
    ...
  },
  "data": {
    "query": "..."
  }
}
```

**Benefits**:
- Larger payload capacity
- Natural for APIs that already use JSON
- Complex nested structures possible

**Drawbacks**:
- Couples payment protocol to HTTP method (GET requests can't have bodies)
- Requires modifying application data structures
- Breaks REST conventions for idempotent methods
- Requires parsing request body before routing
- Content-Type coupling (must use JSON or similar)
- Difficult to add payments to existing APIs without changing contracts

### Option 2: Header-Based Protocol

Payment information is transmitted via HTTP headers:

```http
GET /api/data
Payment-Signature: eyJ4NDAyVmVyc2lvbiI6MiAic2NoZW1lIjogImV4YWN0...
```

**Benefits**:
- Works with any HTTP method (GET, POST, PUT, DELETE, etc.)
- Separates payment concerns from application data
- No modification to request/response bodies needed
- Framework-agnostic (works with REST, GraphQL, gRPC-Web, etc.)
- Can be added to existing APIs without breaking changes
- Consistent with HTTP's separation of concerns (headers for metadata, body for data)

**Drawbacks**:
- Header size limitations (typically 8KB-16KB)
- Base64 encoding required for structured data
- Less natural for deeply nested structures

## Decision

**x402 V2 uses a header-based protocol** for all payment-related communication.

### Specific Headers

1. **Payment-Required** (Response Header)
   - Server responds with `402 Payment Required` status
   - Contains base64-encoded JSON with payment requirements
   - Specifies accepted payment schemes, networks, amounts

2. **Payment-Signature** (Request Header)
   - Client includes payment authorization
   - Contains base64-encoded JSON with payment payload
   - Includes cryptographic signatures proving payment intent

3. **Payment-Response** (Response Header)
   - Server includes settlement details
   - Contains base64-encoded JSON with transaction receipts
   - Confirms on-chain payment execution

### Encoding Strategy

All structured payment data is JSON-encoded, then base64-encoded for header transmission:

```typescript
// From: typescript/packages/core/src/http/index.ts
export function encodePaymentSignatureHeader(
  paymentPayload: PaymentPayload
): string {
  return safeBase64Encode(JSON.stringify(paymentPayload));
}

export function decodePaymentSignatureHeader(
  paymentSignatureHeader: string
): PaymentPayload {
  if (!Base64EncodedRegex.test(paymentSignatureHeader)) {
    throw new Error("Invalid payment signature header");
  }
  return JSON.parse(safeBase64Decode(paymentSignatureHeader));
}
```

This approach:
- Keeps structured data readable (JSON)
- Makes headers safe for HTTP transmission (base64)
- Provides clear validation boundaries
- Enables simple debugging (base64 decode → JSON pretty-print)

## Consequences

### Positive Consequences

#### 1. Universal HTTP Method Support

The header-based approach works seamlessly with all HTTP methods:

```typescript
// GET request with payment - no body modification needed
const response = await fetchWithPayment('https://api.example.com/data', {
  method: 'GET'
});

// POST request with payment - application data unchanged
const response = await fetchWithPayment('https://api.example.com/submit', {
  method: 'POST',
  body: JSON.stringify({ query: "original data" })
});
```

This is particularly important for:
- **GET requests**: RESTful APIs rely heavily on GET for data retrieval
- **HEAD requests**: Can now support payment requirements
- **DELETE requests**: Can be monetized without body hacks
- **OPTIONS requests**: CORS preflight remains unaffected

#### 2. Non-Invasive Integration

Existing APIs can add payment requirements without modifying request/response schemas:

```typescript
// Before: No payments
app.get('/api/data', (req, res) => {
  res.json({ data: getExpensiveData() });
});

// After: With payments - handler unchanged!
app.use(paymentMiddleware({
  "GET /api/data": {
    payTo: "0x...",
    scheme: "exact",
    price: "$0.001",
    network: "eip155:8453"
  }
}, facilitatorClient, [evmScheme]));

app.get('/api/data', (req, res) => {
  res.json({ data: getExpensiveData() });
});
```

The application logic remains **completely unchanged**. Payment handling is middleware-level concern.

#### 3. Framework Agnostic

Headers work identically across different architectural patterns:

**REST APIs**:
```typescript
app.get('/users/:id', handler); // Works
```

**GraphQL**:
```typescript
app.post('/graphql', handler); // Works - payment on endpoint, not per query
```

**RPC-Style**:
```typescript
app.post('/rpc', handler); // Works - body is RPC payload
```

**Server-Sent Events**:
```typescript
app.get('/stream', streamHandler); // Works - headers sent first
```

#### 4. Middleware Composition

Headers enable clean middleware composition patterns:

```typescript
// Payment middleware is just one layer
app.use(corsMiddleware());
app.use(authenticationMiddleware());
app.use(paymentMiddleware(config, facilitator, schemes));
app.use(rateLimitMiddleware());
app.use(loggingMiddleware());

// Each middleware operates on headers independently
// No conflicts or coupling between payment and other concerns
```

#### 5. Developer Experience

Debugging is straightforward:

```bash
# Inspect payment headers easily
curl -v https://api.example.com/protected

# Decode payment requirements
echo "eyJ4NDAyVmVyc2lvbiI6MiAic2NoZW1lIjogImV4YWN0..." | base64 -d | jq

# Test with manual headers
curl -H "Payment-Signature: $(echo '{"x402Version":2,...}' | base64)" \
  https://api.example.com/protected
```

Browser DevTools show headers clearly, making integration debugging simple.

#### 6. Caching and CDN Compatibility

Headers integrate naturally with HTTP caching:

```http
GET /api/public-data
Payment-Signature: ...

HTTP/1.1 200 OK
Cache-Control: public, max-age=3600
Payment-Response: ...
```

CDNs and reverse proxies can:
- Cache responses with payment requirements
- Forward payment headers without understanding them
- Apply standard HTTP caching rules
- Use `Vary: Payment-Signature` for cache keying if needed

### Negative Consequences

#### 1. Header Size Limitations

HTTP headers have practical size limits (typically 8KB-16KB depending on server/proxy configuration). This means:

**Limitation**: Complex payment schemes with large signature data may not fit.

**Mitigation**:
- The `exact` EVM scheme fits comfortably (~2KB encoded)
- Schemes requiring excessive data should use transaction references instead of full data
- Server configuration can increase limits if needed

```typescript
// Good: Compact signature reference
{
  "scheme": "exact",
  "payload": {
    "signature": "0x...", // 65 bytes
    "deadline": 1234567890
  }
}

// Bad: Don't include full transaction history
{
  "scheme": "exact",
  "payload": {
    "signature": "0x...",
    "previousTransactions": [...] // Too large!
  }
}
```

#### 2. Base64 Encoding Overhead

Base64 encoding increases size by ~33%:

```
JSON: 1000 bytes → Base64: 1333 bytes
```

**Mitigation**:
- This overhead is acceptable for payment metadata (typically <2KB)
- Alternative encodings (msgpack, protobuf) could be considered but add complexity
- HTTP/2 header compression helps significantly

#### 3. Less Natural for Complex Structures

Deeply nested payment requirements are awkward in headers:

**Limitation**:
```typescript
// This is clumsy in a header
{
  "accepts": [
    { "scheme": "exact", "tiers": [...], "conditions": {...} }
  ]
}
```

**Mitigation**:
- Keep payment requirements simple and flat
- Use extensions for complex negotiations
- Consider separate discovery endpoints for complex pricing

#### 4. Debugging Requires Decoding

Headers need base64 decoding to read:

**Limitation**: You can't just read the header value directly.

**Mitigation**:
- Provide CLI tools for decoding
- Include browser extensions for development
- Log decoded headers in development mode
- SDK abstracts this away from most developers

```typescript
// SDK handles encoding/decoding automatically
const response = await fetchWithPayment(url);
// Developers never see base64
```

### Design Trade-offs Summary

| Aspect | Body-Based | Header-Based (Chosen) |
|--------|-----------|----------------------|
| **HTTP Method Support** | POST/PUT/PATCH only | All methods |
| **API Modification** | Required | Not required |
| **Framework Coupling** | High (JSON APIs) | None |
| **Size Capacity** | Large (~100MB+) | Limited (~8-16KB) |
| **Caching Compatibility** | Complex | Natural |
| **Middleware Composition** | Difficult | Simple |
| **REST Compliance** | Breaks conventions | Follows conventions |
| **Debugging** | Easy (plain JSON) | Requires decode |

## Implementation Impact

### Server Implementation

Servers check for payment headers before processing requests:

```typescript
// From: e2e/servers/express/index.ts
app.use(paymentMiddleware(
  {
    "GET /protected": {
      payTo: PAYEE_ADDRESS,
      scheme: "exact",
      price: "$0.001",
      network: NETWORK,
    },
  },
  localFacilitatorClient,
  [{ network: NETWORK, server: new ExactEvmService() }]
));

// Handler receives only successful requests
app.get("/protected", (req, res) => {
  res.json({
    message: "Protected endpoint accessed successfully",
    timestamp: new Date().toISOString(),
  });
});
```

Middleware intercepts, validates headers, and only calls handler on successful payment.

### Client Implementation

Clients wrap HTTP libraries to automatically handle payment headers:

```typescript
// From: e2e/clients/fetch/index.ts
const fetchWithPayment = wrapFetchWithPayment(fetch, {
  schemes: [
    {
      network: "eip155:*",
      client: new ExactEvmClient(account),
    },
  ],
});

// Payment headers handled automatically
const response = await fetchWithPayment(url, { method: "GET" });
```

The wrapper:
1. Detects `402 Payment Required` responses
2. Extracts and decodes `Payment-Required` header
3. Generates payment payload
4. Encodes and adds `Payment-Signature` header
5. Retries request
6. Extracts and decodes `Payment-Response` header

## Alternatives Considered

### Hybrid Approach

Use headers for simple payments, body for complex ones:

**Rejected because**: This creates two code paths and confusion about when to use which approach. Consistency is more valuable than accommodating edge cases.

### URL Query Parameters

Encode payment in URL: `?payment=eyJ4NDAyVmVyc2lvbiI6MiAic2NoZW1lIjogImV4YWN0...`

**Rejected because**:
- URLs are logged extensively (security risk for signatures)
- URL length limits are even more restrictive than headers
- URLs are often cached and shared (payment signatures shouldn't be)
- Pollutes REST resource URLs with protocol concerns

### Custom HTTP Methods

Define new methods like `PAID-GET`:

**Rejected because**:
- Not supported by HTTP infrastructure (proxies, CDNs, browsers)
- Would require extensive ecosystem changes
- Violates HTTP specification
- No real benefit over headers

## Related Decisions

- [ADR-002: Facilitator Abstraction](./adr-002-facilitator.md) - How payment verification works
- [ADR-003: Multi-Network Architecture](./adr-003-multi-network.md) - Supporting multiple blockchains
- [ADR-004: Extension System](./adr-004-extensions.md) - Extending payment metadata

## References

- [HTTP/1.1 Header Field Definitions (RFC 7231)](https://tools.ietf.org/html/rfc7231#section-5)
- [HTTP Status Code 402 (RFC 7231 Section 6.5.2)](https://tools.ietf.org/html/rfc7231#section-6.5.2)
- [RESTful Web Services](https://en.wikipedia.org/wiki/Representational_state_transfer)
- Implementation: `typescript/packages/core/src/http/index.ts`

---

*This ADR documents the foundational design choice that shapes the entire x402 V2 protocol.*
