# x402 v2 SDK Understanding Verification Prompt

**Purpose**: Ensure accurate understanding of x402 v2 SDK for external development
**Use**: Share this with any Claude working on x402 v2 integrations

---

## PROMPT START

You are working with the x402 v2 payment protocol SDK. To ensure your understanding is accurate, you MUST read and follow this authoritative reference document:

**Location**: `/Users/fox/Getting Started/x402/docs/X402_V2_REFERENCE_FOR_EXTERNAL_PROJECTS.md`

This document is the **official reference** for x402 v2 SDK usage. All code patterns, APIs, and architectural decisions in this document are verified against the official implementation.

### Critical Rules

1. **If anything conflicts** with the reference document, the reference document is correct
2. **Do not deviate** from the patterns shown without explicit approval
3. **Verify your assumptions** against the reference document before coding
4. **Ask questions** if something is unclear rather than guessing

### Quick Verification Checklist

Before implementing anything, verify:

- [ ] I have read the complete reference document
- [ ] I understand the three components: Client, Server, Facilitator
- [ ] I know that x402 uses **EIP-3009 `transferWithAuthorization()`**, NOT `approve()`/`transferFrom()`
- [ ] I know that clients use `wrapFetchWithPayment()` and **never** create PaymentPayload manually
- [ ] I know that servers use `paymentMiddleware()` and **never** parse payment headers manually
- [ ] I know that all payment headers are base64-encoded JSON
- [ ] I know the standard header names: PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE
- [ ] I have checked the "Common Mistakes" section

### Architecture Understanding

You must understand that x402 v2 has three components:

**1. Client** (uses @x402/fetch):
```typescript
const fetchWithPayment = wrapFetchWithPayment(fetch, {
  schemes: [{ network: "eip155:*", client: new ExactEvmClient(account) }]
});
// Client NEVER manually creates PaymentPayload - wrapper does it
```

**2. Server** (uses @x402/express):
```typescript
app.use(paymentMiddleware(routes, facilitatorClient, schemes));
// Server NEVER manually parses headers - middleware does it
```

**3. Facilitator** (verifies and settles):
```typescript
const facilitator = new x402Facilitator();
facilitator.registerScheme(network, new ExactEvmFacilitator(signer));
// Facilitator verifies signatures and executes on-chain settlements
```

### What You Must NOT Do

❌ **DO NOT** manually create PaymentPayload objects
❌ **DO NOT** have clients call facilitator directly
❌ **DO NOT** manually parse payment headers
❌ **DO NOT** use custom header names
❌ **DO NOT** send unencoded JSON in headers (must be base64)
❌ **DO NOT** deviate from the reference document patterns

### What You Must Do

✅ **DO** use `wrapFetchWithPayment()` for clients
✅ **DO** use `paymentMiddleware()` for servers
✅ **DO** let the SDK handle PaymentPayload creation
✅ **DO** let middleware handle header parsing
✅ **DO** use base64-encoded headers (via SDK functions)
✅ **DO** follow the reference document exactly

### Before Starting Implementation

1. Read the complete reference document
2. Review the "Common Mistakes" section
3. Check your architecture against the reference
4. Verify your understanding with the quick checklist
5. Ask questions if anything is unclear

### If You Need Clarification

If something in your task conflicts with the reference document:
1. **Stop and ask** before implementing
2. **Reference the specific section** of the reference doc
3. **Explain the conflict** you're seeing
4. **Wait for clarification** before proceeding

The reference document represents the official x402 v2 SDK behavior. Deviating from it will cause integration failures.

## PROMPT END

---

## Usage Instructions

**For Coordinators**: Share this prompt with any Claude working on x402 v2 integrations

**For Claudes receiving this**: Read `/Users/fox/Getting Started/x402/docs/X402_V2_REFERENCE_FOR_EXTERNAL_PROJECTS.md` immediately and confirm understanding

---

**This prompt ensures consistent, accurate x402 v2 implementations across all development sessions.**
