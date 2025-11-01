# Server Implementation

Method-by-method breakdown of server implementation.

## Core Methods

### paymentMiddleware()

**Location**: `typescript/packages/http/express/src/index.ts:63`

Creates Express middleware that enforces payments.

**Flow**:
1. Create HTTP context
2. Process request (verify payment)
3. Execute route handler
4. Settle payment (if success)

### processHTTPRequest()

**Location**: `typescript/packages/core/src/http/x402HTTPResourceService.ts:136`

Main request processing logic.

**Returns**:
- `no-payment-required` - Free endpoint
- `payment-verified` - Valid payment, proceed
- `payment-error` - Invalid/missing payment

### processSettlement()

**Location**: `typescript/packages/core/src/http/x402HTTPResourceService.ts`

Settles payment after successful response.

**Steps**:
1. Call facilitator.settle()
2. Encode PAYMENT-RESPONSE header
3. Return headers for middleware to add

---

*Reference: `typescript/packages/http/express/` and `typescript/packages/core/src/http/`*
