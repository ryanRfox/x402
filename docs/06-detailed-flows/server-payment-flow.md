# Server Payment Flow

Complete server execution with object examples at each step.

## Middleware Execution Flow

### 1. Request Received

```typescript
// Incoming request
GET /protected
PAYMENT-SIGNATURE: eyJ4NDAy...
```

### 2. Create Context

```typescript
const context: HTTPRequestContext = {
  adapter: new ExpressAdapter(req),
  path: "/protected",
  method: "GET",
  paymentHeader: "eyJ4NDAy..."
};
```

### 3. Process Request

```typescript
const result = await server.processHTTPRequest(context);
// result.type = "payment-verified"
```

### 4. Execute Handler

```typescript
app.get("/protected", (req, res) => {
  res.json({
    message: "Protected endpoint accessed successfully",
    timestamp: new Date().toISOString()
  });
});
```

### 5. Settle Payment

```typescript
const settlementHeaders = await server.processSettlement(
  paymentPayload,
  requirements,
  200
);
```

**SettleResponse**:
```json
{
  "success": true,
  "transaction": "0xdef456...",
  "network": "eip155:84532",
  "payer": "0xABC..."
}
```

### 6. Send Response

```http
HTTP/1.1 200 OK
PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJ0cmFuc2FjdGlvbiI6...

{"message": "Protected endpoint accessed successfully", ...}
```

---

*See [Server Architecture](../04-reference-implementation/server-architecture.md) for implementation details*
