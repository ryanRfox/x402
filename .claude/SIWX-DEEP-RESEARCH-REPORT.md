# SIWX Deep Research Report

**Date:** December 9, 2025
**Author:** Claude Code Research Agent
**Purpose:** Evaluate Sign-In-With-X (SIWX) integration possibilities for the x402 payment protocol

---

## Executive Summary

Sign-In with X (SIWX) represents a family of chain-agnostic authentication standards that enable users to prove ownership of blockchain addresses through cryptographic signatures. The most mature implementations are **EIP-4361 (Sign-In with Ethereum)** and Phantom's **Sign-In with Solana (SIWS)**, both of which follow the abstract **CAIP-122** specification for chain-agnostic authentication.

**Key Findings:**

1. **SIWX is complementary to x402, not competitive** - SIWX handles identity verification, while x402 handles micropayments. Together they could enable "pay-per-identity-tier" or "authenticated payments" use cases.

2. **Integration is feasible via x402's extension system** - The protocol's `extensions` field in `PaymentRequired` responses provides a natural integration point without requiring core protocol changes.

3. **Session management differs fundamentally** - SIWX typically establishes session-based authentication (like OAuth), while x402 currently uses per-request payment credentials. Bridging this gap requires architectural decisions.

4. **AI agents present unique challenges** - SIWX assumes interactive wallet prompts, which AI agents cannot provide. Any integration must support both human and agent workflows.

5. **Competitive approaches (LSAT, Unlock) show different patterns** - LSAT combines authentication+payment atomically via Lightning, while Unlock uses NFT ownership for membership gating. x402+SIWX would be unique in separating identity from payment while supporting both.

---

## 1. ERC-4361 Implementation Analysis

### Message Format

EIP-4361 defines a human-readable, structured message format that users sign with their Ethereum wallet:

```
${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${uri}
Version: ${version}
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}
Not Before: ${notBefore}
Request ID: ${requestId}
Resources:
- ${resources[0]}
- ${resources[1]}
```

**Key message fields:**
- **domain** (required): RFC 4501 authority requesting the signature (e.g., `api.example.com`)
- **address** (required): Ethereum address in EIP-55 checksum format
- **statement** (optional): Human-readable assertion (cannot contain `\n`)
- **uri** (required): RFC 3986 URI of the resource subject
- **version** (required): Message version (currently "1")
- **chainId** (required): EIP-155 chain ID (e.g., 1 for mainnet, 8453 for Base)
- **nonce** (required): Min 8 alphanumeric chars for replay protection
- **issuedAt** (optional): ISO 8601 datetime
- **expirationTime** (optional): ISO 8601 datetime for session expiry
- **notBefore** (optional): ISO 8601 datetime for delayed activation
- **requestId** (optional): System-specific identifier
- **resources** (optional): List of URIs (prefixed with `- `)

### Verification Flow

The reference implementation in `@spruceid/siwe` follows this pattern:

**1. Nonce Generation (Server)**
```javascript
import { generateNonce } from 'siwe';
const nonce = generateNonce(); // Generates 8+ alphanumeric string
req.session.nonce = nonce;
```

**2. Message Construction (Client)**
```javascript
import { SiweMessage } from 'siwe';
const message = new SiweMessage({
  domain: window.location.host,
  address: account, // From wallet
  statement: 'Sign in to My App',
  uri: window.location.origin,
  version: '1',
  chainId: 1,
  nonce: nonce, // From server
});
const preparedMessage = message.prepareMessage();
```

**3. Signature Request (Client)**
```javascript
const signature = await provider.request({
  method: 'personal_sign',
  params: [preparedMessage, account],
});
```

**4. Verification (Server)**
```javascript
const siweMessage = new SiweMessage(receivedMessage);
const { data: verifiedMessage } = await siweMessage.verify({
  signature: signature,
  nonce: req.session.nonce,
  domain: req.get('host'),
});

// Success - store session
req.session.siwe = verifiedMessage;
req.session.cookie.expires = new Date(verifiedMessage.expirationTime);
```

**Verification checks performed:**
- Domain binding (prevents phishing)
- Nonce matching (prevents replay attacks)
- Signature validity (proves address ownership)
- Timestamp validation (issuedAt, expirationTime, notBefore)
- EIP-1271 support (contract wallet signatures)

### Nonce Management

**Critical security requirement:** Each nonce MUST be single-use and server-generated.

**Common patterns:**
1. **Session-based:** Store nonce in server session, clear after verification
2. **Database-backed:** Store nonce+timestamp in DB, mark as used after verification
3. **Stateless:** Encode timestamp+HMAC in nonce, verify HMAC and freshness

**Implementation example (session-based):**
```javascript
// Generation
app.get('/nonce', (req, res) => {
  req.session.nonce = generateNonce();
  res.send(req.session.nonce);
});

// Verification
app.post('/verify', async (req, res) => {
  const { message, signature } = req.body;
  const siwe = new SiweMessage(message);

  const result = await siwe.verify({
    signature,
    nonce: req.session.nonce, // Must match
  });

  // Invalidate nonce
  req.session.nonce = null;
  req.session.siwe = result.data;
  req.session.save();
});
```

### Security Considerations

**1. Domain Binding**
- MUST verify `message.domain` matches `req.get('host')`
- Prevents cross-site signature phishing
- Wallets display domain to users for verification

**2. Nonce Uniqueness**
- Each nonce MUST be used exactly once
- Minimum 8 alphanumeric characters
- Cryptographically random (use `crypto.randomBytes()`)

**3. Timestamp Validation**
- `issuedAt` should be close to current time (±10 min threshold common)
- `expirationTime` must be in the future
- `notBefore` must be in the past

**4. Session Binding**
- Sessions MUST be bound to the verified address
- Do NOT allow address changes without re-authentication
- Chain ID should also be stored in session

**5. Transport Security**
- Always use HTTPS in production
- Set secure cookie flags (`secure: true, httpOnly: true`)
- Use `sameSite: 'strict'` or `'lax'` for CSRF protection

**6. Smart Contract Wallets**
- Support EIP-1271 for contract-based wallets (Gnosis Safe, Argent, etc.)
- Requires ethers provider to call contract's `isValidSignature` function

---

## 2. CAIP-122 Chain-Agnostic Analysis

### Specification Overview

CAIP-122 (Sign In With X) abstracts EIP-4361 to work with any blockchain namespace expressible in CAIP-10 (Account ID) and CAIP-2 (Chain ID) formats.

**Key abstraction:** Instead of Ethereum-specific addresses/chains, use:
- **CAIP-10 address:** `<chain_id>:<account_address>` (e.g., `eip155:1:0x742d35Cc...`)
- **CAIP-2 chain ID:** `<namespace>:<reference>` (e.g., `eip155:1`, `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)

**Abstract data model fields:**
- `domain` (required): RFC 4501 authority
- `account_address` (required): CAIP-10 account address segment (NO chain_id prefix)
- `uri` (required): RFC 3986 URI
- `version` (required): Message version
- `statement` (optional): Human-readable assertion
- `nonce` (optional): Replay protection token
- `issued-at` (optional): RFC 3339 datetime
- `expiration-time` (optional): RFC 3339 datetime
- `not-before` (optional): RFC 3339 datetime
- `request-id` (optional): System identifier
- `chain_id` (required): CAIP-2 chain identifier
- `resources` (optional): List of URIs
- `signature` (required): Signature bytes
- `type` (required): Signature type (e.g., `eip191`, `ed25519`)

**Message format template:**
```
${domain} wants you to sign in with your ${blockchain} account:
${account_address}

${statement}

URI: ${uri}
Version: ${version}
Chain ID: ${chain_id}
Nonce: ${nonce}
Issued At: ${issued-at}
Expiration Time: ${expiration-time}
Not Before: ${not-before}
Request ID: ${request-id}
Resources:
- ${resources[0]}
```

### Solana (SIWS) Support

**Phantom's Sign-In with Solana** implements CAIP-122 with Solana-specific adaptations.

**Key differences from Ethereum:**
1. **Raw bytes signing:** Solana cannot sign plaintext, only `Uint8Array`
   - Message is constructed as text, then converted to bytes
   - `new TextEncoder().encode(messageText)`

2. **Ed25519 signatures:** Different algorithm than Ethereum's ECDSA
   - Signature type: `solana:ed25519`
   - Verification uses `nacl.sign.detached.verify()`

3. **Address format:** Base58-encoded public keys (32-44 chars)
   - Example: `GwAF45zjfyGzUbd3i3hXxzGeuchzEZXwpRYHZM5912F1`

4. **Chain IDs:**
   - `mainnet`, `testnet`, `devnet`, `localnet`
   - Or full CAIP-2: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` (mainnet)

**SIWS message example:**
```
service.org wants you to sign in with your Solana account:
GwAF45zjfyGzUbd3i3hXxzGeuchzEZXwpRYHZM5912F1

I accept the Terms of Service: https://service.org/tos

URI: https://service.org/login
Version: 1
Chain ID: mainnet
Nonce: 32891757
Issued At: 2021-09-30T16:25:24.000Z
Resources:
- ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu
```

**Verification helper (Solana Wallet Standard):**
```typescript
import { verifySignIn } from '@solana/wallet-standard-util';

const isValid = verifySignIn(
  input: SolanaSignInInput,
  output: SolanaSignInOutput
);
```

The `verifySignIn` helper:
1. Parses `signedMessage` bytes back to text
2. Validates fields against `input`
3. Reconstructs message according to ABNF format
4. Verifies Ed25519 signature

### Applicability to x402 SVM

**x402 already supports Solana** via:
- `@x402/svm/exact` scheme
- CAIP-2 network identifiers (`solana:mainnet`, `solana:devnet`)
- Solana-native payment mechanisms (SOL, USDC via Circle CCTP)

**SIWX integration for x402 SVM would enable:**
1. **Authenticated payments** - Prove payer identity before accepting payment
2. **Address reputation** - Servers could track payment history by verified address
3. **Tiered pricing** - Different rates for verified vs anonymous payers
4. **Compliance** - KYC/AML via address verification (where required)

**Implementation path:**
- Use `@solana/wallet-standard-features` for signIn
- Store verified address in payment metadata
- Extend x402 facilitator to optionally require SIWS proof
- Add SIWS verification to server hooks (`onBeforeVerify`)

**Challenges:**
- Solana wallets need Wallet Standard 1.1.0+ for `signIn` feature
- Not all Solana wallets support SIWS yet (Phantom does)
- AI agents cannot interactively sign messages (need alternative flow)

---

## 3. Existing Integration Patterns

### Pattern 1: SIWE + NextAuth.js (Session-Based)

**Source:** [NextAuth.js SIWE Integration](https://docs.login.xyz/integrations/nextauth.js), [RainbowKit SIWE](https://www.npmjs.com/package/@rainbow-me/rainbowkit-siwe-next-auth)

**Architecture:**
```
┌─────────┐         ┌──────────┐         ┌─────────┐
│ Client  │ ─┬───── │ NextAuth │ ─────── │ Session │
│ (Wagmi) │  │      │  Server  │         │  Store  │
└─────────┘  │      └──────────┘         └─────────┘
             │
             └────── Wallet (MetaMask, Rainbow, etc.)
```

**Flow:**
1. **Connect wallet:** User connects via WalletConnect/Injected provider
2. **Generate nonce:** Client fetches `/api/auth/siwe/nonce`
3. **Sign message:** Wallet signs SIWE message with nonce
4. **Verify:** POST to `/api/auth/siwe/verify` with message+signature
5. **Session:** NextAuth creates JWT session, stores address in token
6. **Protected routes:** Use `getServerSession()` to check auth

**Code snippet:**
```typescript
// pages/api/auth/[...nextauth].ts
import CredentialsProvider from 'next-auth/providers/credentials';
import { SiweMessage } from 'siwe';

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Ethereum',
      credentials: {
        message: { label: 'Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
      },
      async authorize(credentials) {
        const siwe = new SiweMessage(JSON.parse(credentials?.message || '{}'));
        const result = await siwe.verify({
          signature: credentials?.signature || '',
        });

        if (result.success) {
          return {
            id: siwe.address,
            address: siwe.address,
            chainId: siwe.chainId,
          };
        }
        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.address;
        token.address = user.address;
      }
      return token;
    },
  },
});
```

**Key characteristics:**
- **Session-based:** One sign-in, multiple requests
- **JWT tokens:** Stateless session management
- **Framework-specific:** Tightly coupled to Next.js
- **No per-request signatures:** Auth is session-scoped

**Applicability to x402:**
- ❌ x402 is currently per-request (no sessions)
- ⚠️ Would require adding session management layer
- ✅ Could use SIWE session to gate x402 endpoints
- ✅ Extensions field could reference SIWE session

### Pattern 2: SIWS + Solana Wallet Adapter (Hybrid)

**Source:** [Phantom SIWS Guide](https://github.com/phantom/sign-in-with-solana)

**Architecture:**
```
┌─────────┐         ┌──────────┐         ┌─────────┐
│ Client  │ ─┬───── │  Backend │ ─────── │ Session │
│ (React) │  │      │  Verify  │         │  Store  │
└─────────┘  │      └──────────┘         └─────────┘
             │
             └────── Wallet Adapter (signIn feature)
```

**Flow:**
1. **Auto-connect:** WalletProvider detects `signIn` feature support
2. **Generate input:** Backend creates `SolanaSignInInput` (can be empty)
3. **Wallet signIn:** Single method call `adapter.signIn(input)`
4. **Wallet constructs message:** Wallet builds message from input
5. **Wallet signs:** User approves in single click
6. **Backend verify:** POST `{input, output}` to `/verify` endpoint
7. **Session:** Backend stores verified address in session

**Code snippet:**
```typescript
// Frontend (React)
const autoSignIn = useCallback(async (adapter: Adapter) => {
  if (!('signIn' in adapter)) return true; // Fallback to legacy connect

  // Fetch input from backend (can be minimal)
  const inputRes = await fetch('/api/createSignInData');
  const input: SolanaSignInInput = await inputRes.json();

  // Single wallet call
  const output = await adapter.signIn(input);

  // Verify server-side
  const verifyRes = await fetch('/api/verifySIWS', {
    method: 'POST',
    body: JSON.stringify({ input, output }),
  });

  const success = await verifyRes.json();
  if (!success) throw new Error('Verification failed');

  return false; // Don't auto-connect (already signed in)
}, []);

// Backend (Node.js)
import { verifySignIn } from '@solana/wallet-standard-util';

app.post('/api/verifySIWS', (req, res) => {
  const { input, output } = req.body;

  // Deserialize Uint8Arrays
  const serializedOutput = {
    account: {
      publicKey: new Uint8Array(output.account.publicKey),
      ...output.account,
    },
    signature: new Uint8Array(output.signature),
    signedMessage: new Uint8Array(output.signedMessage),
  };

  const isValid = verifySignIn(input, serializedOutput);
  res.json(isValid);
});
```

**Key characteristics:**
- **Wallet-constructed messages:** dApp doesn't build message text
- **Single-click UX:** Combines connect + sign into one step
- **Backward compatible:** Falls back to legacy `connect` + `signMessage`
- **Minimal input:** Can send empty `{}` for simplest flow

**Applicability to x402:**
- ✅ Similar per-request model (signIn can be re-triggered)
- ✅ Could integrate with x402 client's payment flow
- ⚠️ Requires Wallet Standard support (not all wallets)
- ✅ Better UX than SIWE for Solana

### Pattern 3: SIWE + Express Session (Traditional)

**Source:** [SIWE Quickstart Complete App](https://github.com/spruceid/siwe-quickstart/tree/main/03_complete_app)

**Architecture:**
```
┌─────────┐         ┌──────────┐         ┌─────────┐
│ Client  │ ─┬───── │ Express  │ ─────── │ Session │
│  (Web)  │  │      │  Server  │         │  Store  │
└─────────┘  │      └──────────┘         └─────────┘
             │
             └────── MetaMask (personal_sign)
```

**Flow:**
1. **GET /nonce:** Client fetches fresh nonce
2. **Sign:** Client constructs SIWE message, wallet signs
3. **POST /verify:** Client sends {message, signature}
4. **Verify:** Server validates, stores in session
5. **Protected routes:** Check `req.session.siwe` for auth

**Code snippet:**
```javascript
// Server (Express)
const app = express();
app.use(Session({
  secret: 'your-secret',
  resave: true,
  saveUninitialized: true,
}));

app.get('/nonce', (req, res) => {
  req.session.nonce = generateNonce();
  res.send(req.session.nonce);
});

app.post('/verify', async (req, res) => {
  const { message, signature } = req.body;
  const siwe = new SiweMessage(message);

  const { data } = await siwe.verify({
    signature,
    nonce: req.session.nonce,
  });

  req.session.siwe = data;
  req.session.cookie.expires = new Date(data.expirationTime);
  req.session.save(() => res.send(true));
});

app.get('/protected', (req, res) => {
  if (!req.session.siwe) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.send(`Authenticated as ${req.session.siwe.address}`);
});
```

**Key characteristics:**
- **Session-based:** Traditional web app model
- **Cookie storage:** express-session with cookie store
- **Middleware protection:** Check session in route handlers
- **Session expiry:** Matches SIWE message's expirationTime

**Applicability to x402:**
- ⚠️ Fundamentally different model (sessions vs per-request)
- ✅ Could wrap x402 middleware with session check
- ✅ Compatible with existing Express apps
- ❌ Doesn't align with x402's stateless philosophy

### Common Approaches Summary

| Pattern | Session Model | Framework | Best For | x402 Alignment |
|---------|---------------|-----------|----------|----------------|
| NextAuth.js | JWT tokens | Next.js | Web apps with auth | Low (session-based) |
| Solana Adapter | Hybrid | React | Solana dApps | Medium (per-request capable) |
| Express Session | Cookie-based | Express | Traditional backends | Low (stateful) |

**Common themes:**
1. **Nonce generation is server-side** - Never trust client nonces
2. **Verification happens on backend** - Don't verify signatures client-side
3. **Sessions store address** - Address is the primary identity
4. **Expiry is configurable** - Short-lived (hours) or long-lived (days)

**Divergence from x402:**
- **SIWE/SIWS establish sessions** - One sign-in, many requests
- **x402 is per-request** - Each request includes payment proof
- **SIWE is authentication only** - No payment/authorization
- **x402 is payment-focused** - Authentication is optional

---

## 4. x402-Specific Integration Points

### Client Layer

**Current architecture:**
```typescript
// @x402/fetch/src/index.ts
export function wrapFetchWithPayment(
  fetch: typeof globalThis.fetch,
  client: x402Client | x402HTTPClient
) {
  return async (input, init) => {
    const response = await fetch(input, init);

    if (response.status !== 402) return response;

    // Parse payment requirements
    const paymentRequired = httpClient.getPaymentRequiredResponse(...);

    // Create payment
    const paymentPayload = await client.createPaymentPayload(paymentRequired);

    // Retry with payment
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
    return fetch(input, { ...init, headers: { ...init.headers, ...paymentHeaders } });
  };
}
```

**Integration option 1: Parallel authentication**
Add SIWE proof alongside payment in same request:
```typescript
// Extended client
export function wrapFetchWithPaymentAndAuth(
  fetch: typeof globalThis.fetch,
  client: x402Client,
  siweProvider: SIWEProvider // New abstraction
) {
  return async (input, init) => {
    const response = await fetch(input, init);

    if (response.status === 401) {
      // Authentication required (separate from payment)
      const siweChallenge = await response.json();
      const siweProof = await siweProvider.signIn(siweChallenge);
      return fetch(input, {
        ...init,
        headers: {
          ...init.headers,
          'Authorization': `SIWE ${siweProof}`,
        },
      });
    }

    if (response.status === 402) {
      // Payment required (existing flow)
      const paymentRequired = httpClient.getPaymentRequiredResponse(...);

      // Check if SIWE is required via extensions
      const requiresAuth = paymentRequired.extensions?.siwe?.required;

      let siweProof;
      if (requiresAuth) {
        siweProof = await siweProvider.signIn(paymentRequired.extensions.siwe);
      }

      const paymentPayload = await client.createPaymentPayload(paymentRequired);

      // Include both payment and auth
      return fetch(input, {
        ...init,
        headers: {
          ...init.headers,
          ...httpClient.encodePaymentSignatureHeader(paymentPayload),
          ...(siweProof ? { 'Authorization': `SIWE ${siweProof}` } : {}),
        },
      });
    }

    return response;
  };
}
```

**Integration option 2: Extension-based**
Embed SIWE signature in payment payload's `extensions` field:
```typescript
// Modified createPaymentPayload
const paymentPayload = await client.createPaymentPayload(paymentRequired);

// If SIWE is requested in extensions
if (paymentRequired.extensions?.siwe) {
  const siweMessage = new SiweMessage({
    domain: paymentRequired.extensions.siwe.domain,
    address: await signer.getAddress(),
    nonce: paymentRequired.extensions.siwe.nonce,
    ...
  });

  const signature = await signer.signMessage(siweMessage.prepareMessage());

  paymentPayload.extensions = {
    ...paymentPayload.extensions,
    siwe: {
      message: siweMessage.prepareMessage(),
      signature: signature,
    },
  };
}
```

**Pros/cons:**

| Approach | Pros | Cons |
|----------|------|------|
| Parallel (401+402) | Clean separation of concerns | Two round trips if both required |
| Extension-based | Single round trip | Couples identity to payment |

### Server Layer

**Current architecture:**
```typescript
// @x402/express/src/index.ts
export function paymentMiddleware(
  routes: RoutesConfig,
  server: x402ResourceServer,
  paywallConfig?: PaywallConfig
) {
  const httpServer = new x402HTTPResourceServer(server, routes);

  return async (req, res, next) => {
    const context = {
      path: req.path,
      method: req.method,
      paymentHeader: adapter.getHeader('payment-signature'),
    };

    if (!httpServer.requiresPayment(context)) {
      return next();
    }

    const result = await httpServer.processHTTPRequest(context, paywallConfig);

    switch (result.type) {
      case 'no-payment-required': return next();
      case 'payment-error': return res.status(402).json(...);
      case 'payment-verified':
        // Settle payment after response
        next();
        await httpServer.processSettlement(...);
    }
  };
}
```

**Integration option 1: Separate SIWE middleware**
Stack SIWE before payment:
```typescript
import { siweMiddleware } from '@x402/siwe'; // Hypothetical

app.use(siweMiddleware({
  routes: {
    'GET /premium': { required: true, allowAnonymous: false },
    'GET /public': { required: false },
  },
  sessionStore: redisStore,
}));

app.use(paymentMiddleware({
  'GET /premium': {
    accepts: {
      payTo: SERVER_ADDRESS,
      scheme: 'exact',
      network: 'eip155:8453',
      price: (req) => {
        // Access SIWE session
        const isVerified = req.session?.siwe?.address;
        return isVerified ? '$0.001' : '$0.005'; // Discount for verified
      },
    },
  },
}));
```

**Integration option 2: SIWE as extension**
Add to payment requirements:
```typescript
app.use(paymentMiddleware({
  'GET /premium': {
    accepts: {
      payTo: SERVER_ADDRESS,
      scheme: 'exact',
      network: 'eip155:8453',
      price: '$0.01',
    },
    extensions: {
      siwe: {
        required: true,
        domain: 'api.example.com',
        statement: 'Authenticate to access premium content',
      },
    },
  },
}));
```

**Integration option 3: Lifecycle hooks**
Use x402's hook system:
```typescript
server.onBeforeVerify(async (context) => {
  const { paymentPayload, requirements } = context;

  // Check if SIWE is required
  if (requirements.extra?.requireSIWE) {
    const siweData = paymentPayload.extensions?.siwe;

    if (!siweData) {
      return { abort: true, reason: 'SIWE authentication required' };
    }

    // Verify SIWE
    const siwe = new SiweMessage(siweData.message);
    const result = await siwe.verify({
      signature: siweData.signature,
      nonce: requirements.extra.siweNonce,
    });

    if (!result.success) {
      return { abort: true, reason: 'Invalid SIWE signature' };
    }

    // Store verified address for later use
    context.verifiedAddress = siwe.address;
  }
});
```

**Recommended: Hook-based approach**
- ✅ No core protocol changes
- ✅ Opt-in per route
- ✅ Access to full payment context
- ✅ Can enrich payment requirements with SIWE challenge

### Facilitator Layer

**Current architecture:**
```typescript
// @x402/evm/exact/facilitator/scheme.ts
export class EVMExactFacilitatorScheme implements SchemeNetworkFacilitator {
  async verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
    // Verify payment signature is valid
    // Check amounts match
    // Return { isValid: true/false }
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
    // Execute on-chain settlement
    // Return { success: true/false, txHash }
  }
}
```

**Should facilitator validate SIWE?**

**Option A: Facilitator validates SIWE**
```typescript
async verify(payload: PaymentPayload, requirements: PaymentRequirements) {
  // Existing payment verification
  const paymentValid = await this.verifyPaymentSignature(payload);
  if (!paymentValid) return { isValid: false, invalidReason: 'Invalid payment' };

  // SIWE verification (if required)
  if (requirements.extensions?.siwe) {
    const siweValid = await this.verifySIWE(
      payload.extensions?.siwe,
      requirements.extensions.siwe
    );
    if (!siweValid) return { isValid: false, invalidReason: 'Invalid SIWE' };
  }

  return { isValid: true };
}
```

**Option B: Server validates SIWE (hooks)**
```typescript
// Facilitator stays payment-focused
async verify(payload: PaymentPayload, requirements: PaymentRequirements) {
  // Only verify payment
  return await this.verifyPaymentSignature(payload);
}

// Server handles SIWE via hooks (shown above)
```

**Recommendation: Option B (Server hooks)**
- Facilitator should focus on payment settlement
- SIWE is application-layer concern
- Server hooks provide flexibility
- Allows different SIWE policies per server

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │  Payment Provider    │    │    SIWE Provider         │  │
│  │  (x402Client)        │    │    (Optional)            │  │
│  └──────────────────────┘    └──────────────────────────┘  │
│            │                            │                    │
│            └────────────┬───────────────┘                    │
│                         │                                    │
│                    Fetch Wrapper                             │
│                    (wrapFetchWithPayment)                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP Request
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        SERVER LAYER                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           x402HTTPResourceServer                      │  │
│  │  ┌────────────────┐    ┌────────────────────────┐   │  │
│  │  │ Payment Check  │    │ Lifecycle Hooks        │   │  │
│  │  │ (Required?)    │───▶│ - onBeforeVerify       │   │  │
│  │  │                │    │   * Check SIWE         │   │  │
│  │  └────────────────┘    │ - onAfterVerify        │   │  │
│  │                        │ - onBeforeSettle       │   │  │
│  │                        └────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│              x402ResourceServer.verifyPayment()             │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │ RPC Call
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     FACILITATOR LAYER                        │
│              (Focuses on payment only)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │    EVMExactFacilitatorScheme.verify()                │  │
│  │    - Verify payment signature                        │  │
│  │    - Check amount/asset match                        │  │
│  │    - Return { isValid }                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Data flow for authenticated payment:**

1. **Server declares SIWE in extensions:**
```json
{
  "x402Version": 2,
  "resource": { ... },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "amount": "1000000",
    "asset": "0x833...",
    "payTo": "0xABC...",
    "maxTimeoutSeconds": 300,
    "extra": {}
  }],
  "extensions": {
    "siwe": {
      "required": true,
      "domain": "api.example.com",
      "nonce": "Xy7z9B3q",
      "statement": "Sign in to access this resource"
    }
  }
}
```

2. **Client creates payment + SIWE proof:**
```typescript
const paymentPayload = await x402Client.createPaymentPayload(paymentRequired);

if (paymentRequired.extensions?.siwe) {
  const siweMessage = new SiweMessage({
    domain: paymentRequired.extensions.siwe.domain,
    address: await signer.getAddress(),
    nonce: paymentRequired.extensions.siwe.nonce,
    statement: paymentRequired.extensions.siwe.statement,
    uri: paymentRequired.resource.url,
    version: '1',
    chainId: parseInt(paymentRequired.accepts[0].network.split(':')[1]),
  });

  const signature = await signer.signMessage(siweMessage.prepareMessage());

  paymentPayload.extensions = {
    siwe: {
      message: siweMessage.prepareMessage(),
      signature: signature,
    },
  };
}
```

3. **Server verifies SIWE via hook:**
```typescript
server.onBeforeVerify(async ({ paymentPayload, requirements }) => {
  if (requirements.extensions?.siwe?.required) {
    const siweData = paymentPayload.extensions?.siwe;
    if (!siweData) {
      return { abort: true, reason: 'SIWE required but not provided' };
    }

    const siwe = new SiweMessage(siweData.message);
    const { data, error } = await siwe.verify({
      signature: siweData.signature,
      nonce: requirements.extensions.siwe.nonce,
      domain: requirements.extensions.siwe.domain,
    });

    if (error) {
      return { abort: true, reason: `SIWE verification failed: ${error.type}` };
    }

    // Success - address is verified
    // Can use data.address for further checks
  }
});
```

4. **Facilitator processes payment only:**
```typescript
// Facilitator doesn't see SIWE - already validated by server hook
const verifyResult = await facilitatorClient.verify(paymentPayload, requirements);
```

---

## 5. Open Questions Answered

### Auth-gated vs Pay-gated

**Question:** Can SIWE replace payment for certain resources (auth-gated vs pay-gated)?

**Answer:** Yes, and this creates interesting pricing models:

**Model 1: Auth OR Payment (alternative gates)**
```typescript
const routes = {
  'GET /article': {
    // Either authenticate OR pay
    alternatives: [
      {
        type: 'auth',
        method: 'siwe',
        networks: ['eip155:*'],
      },
      {
        type: 'payment',
        accepts: {
          scheme: 'exact',
          network: 'eip155:8453',
          price: '$0.10',
          payTo: SERVER_ADDRESS,
        },
      },
    ],
  },
};
```

**Model 2: Tiered pricing by identity**
```typescript
'GET /api/query': {
  accepts: {
    scheme: 'exact',
    network: 'eip155:8453',
    payTo: SERVER_ADDRESS,
    price: (req) => {
      // Anonymous users pay more
      if (!req.session?.siwe) return '$1.00';

      // Verified users get discount
      const address = req.session.siwe.address;
      if (isPremiumMember(address)) return '$0.10';
      return '$0.50';
    },
  },
  extensions: {
    siwe: {
      required: false, // Optional but gives discount
    },
  },
},
```

**Model 3: Auth AND Payment (both required)**
```typescript
'GET /premium': {
  accepts: {
    scheme: 'exact',
    network: 'eip155:8453',
    price: '$5.00',
    payTo: SERVER_ADDRESS,
  },
  extensions: {
    siwe: {
      required: true, // MUST authenticate to pay
      statement: 'Verify identity before purchasing',
    },
  },
},
```

**Model 4: Free for authenticated, paid otherwise**
```typescript
'GET /community': {
  accepts: {
    scheme: 'exact',
    network: 'eip155:8453',
    payTo: SERVER_ADDRESS,
    price: (req) => {
      // Free for members
      if (req.session?.siwe && isCommunityMember(req.session.siwe.address)) {
        return { amount: '0', asset: 'FREE' }; // Special case: no payment
      }
      // Guests pay
      return '$2.00';
    },
  },
},
```

**Use cases:**
- **Freemium content:** Free for verified users, paid for anonymous
- **Compliance:** Only accept payments from identified addresses
- **Reputation systems:** Discount based on on-chain reputation (DAO membership, NFT holdings)
- **Anti-spam:** Require identity OR payment to prevent bots

### Identity in accepts Array

**Question:** How should identity interact with the `accepts` array in PaymentRequirements?

**Answer:** Identity should be in `extensions`, not `accepts`. Here's why:

**Why NOT in accepts:**
1. `accepts` is for payment options - scheme, network, asset, amount
2. Multiple `accepts` items = alternative payment methods (USDC vs ETH)
3. Identity is orthogonal to payment mechanism
4. Mixing them would complicate client selection logic

**Recommended structure:**
```typescript
interface PaymentRequired {
  x402Version: 2,
  resource: ResourceInfo,
  accepts: PaymentRequirements[], // Only payment options
  extensions?: {
    siwe?: {
      required: boolean,
      domain: string,
      nonce: string,
      statement?: string,
      chainId?: number, // Hint: which chain to sign with
      // ... other SIWE fields
    },
    // Other extensions (bazaar, etc.)
  }
}
```

**Client selection algorithm with SIWE:**
```typescript
// 1. Filter to supported networks
const supportedPayments = paymentRequired.accepts.filter(req =>
  client.supportsNetwork(req.network)
);

// 2. Check SIWE requirement
const siweRequired = paymentRequired.extensions?.siwe?.required;
if (siweRequired) {
  const canSignSIWE = await client.canSignSIWE(
    paymentRequired.extensions.siwe.chainId
  );
  if (!canSignSIWE) {
    throw new Error('SIWE required but cannot sign');
  }
}

// 3. Select payment (existing logic)
const selectedPayment = client.selectPayment(supportedPayments);

// 4. Create payment + SIWE
const paymentPayload = await client.createPaymentPayload(selectedPayment);
if (siweRequired) {
  paymentPayload.extensions.siwe = await client.createSIWEProof(
    paymentRequired.extensions.siwe
  );
}
```

**Edge case:** What if payment is on Base but SIWE requires mainnet?
```json
{
  "accepts": [{
    "network": "eip155:8453",
    "asset": "0x833...",
    "scheme": "exact"
  }],
  "extensions": {
    "siwe": {
      "required": true,
      "chainId": 1,
      "statement": "Sign with mainnet address to prove identity"
    }
  }
}
```

**Solution:** Client must have signers for both chains:
- Payment signer on Base (eip155:8453)
- Identity signer on Mainnet (eip155:1)

This is actually a feature - allows separation of "hot wallet" (payments) from "identity wallet" (mainnet ENS).

### Per-request vs Session

**Question:** Should identity be per-request or session-based?

**Answer:** **Support both**, but default to session-based for practicality.

**Per-request identity (stateless):**
```typescript
// Every request includes fresh SIWE signature
POST /api/query
Headers:
  Payment-Signature: <x402 payment>
  Authorization: SIWE <message>|<signature>
```

**Pros:**
- ✅ Stateless server (no session storage)
- ✅ Works with multiple servers (no session sync)
- ✅ Aligns with x402's per-request payment model

**Cons:**
- ❌ Requires signing every request (terrible UX)
- ❌ High wallet interaction overhead
- ❌ Nonce management is complex (need long-lived nonces?)

**Session-based identity (stateful):**
```typescript
// Sign in once, get session token
POST /auth/siwe
Body: { message, signature }
Response: Set-Cookie: session=abc123

// Future requests use session
POST /api/query
Headers:
  Payment-Signature: <x402 payment>
  Cookie: session=abc123
```

**Pros:**
- ✅ Sign once, use many times (good UX)
- ✅ Standard web pattern (cookies, JWTs)
- ✅ Compatible with existing auth libraries

**Cons:**
- ❌ Requires session storage (Redis, DB)
- ❌ Server-side state (harder to scale)
- ❌ Sessions can be hijacked (need secure cookies)

**Hybrid approach (JWT-based):**
```typescript
// Sign in once, get JWT
POST /auth/siwe
Body: { message, signature }
Response: { token: <JWT signed by server> }

// Future requests include JWT
POST /api/query
Headers:
  Payment-Signature: <x402 payment>
  Authorization: Bearer <JWT>
```

**JWT payload:**
```json
{
  "sub": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "chainId": 1,
  "exp": 1735776000, // 24h from issuance
  "iat": 1735689600,
  "iss": "api.example.com",
  "siwe": {
    "domain": "api.example.com",
    "issuedAt": "2025-01-01T00:00:00Z",
    "expirationTime": "2025-01-02T00:00:00Z"
  }
}
```

**Pros:**
- ✅ Stateless server (no session storage)
- ✅ Standard JWT verification
- ✅ Can include extra claims (address, chainId)

**Cons:**
- ⚠️ Cannot revoke before expiry (unless using token blacklist)
- ⚠️ Requires server signing key management

**Recommendation:**
1. **Default: Session-based** - Best UX, standard pattern
2. **Optional: JWT-based** - For stateless deployments
3. **Not recommended: Per-request** - Unless for ultra-sensitive operations

**Implementation:**
```typescript
// 1. Client signs in (separate from payment)
const siweSession = await fetch('/auth/siwe', {
  method: 'POST',
  body: JSON.stringify({ message, signature }),
});
const { token } = await siweSession.json();

// 2. Client stores token
localStorage.setItem('siwe_token', token);

// 3. Future x402 requests include token
const fetchWithPayment = wrapFetchWithPayment(fetch, x402Client, {
  siweToken: localStorage.getItem('siwe_token'), // Auto-include in headers
});
```

### AI Agent Authentication

**Question:** How does this interact with AI agents (they can't interactively sign)?

**Answer:** AI agents need **pre-authorized credentials** or **delegated signing**.

**Challenge:** Traditional SIWE assumes:
1. User sees message in wallet UI
2. User clicks "Sign"
3. Wallet prompts for approval

AI agents can't do interactive prompts.

**Solution 1: API keys instead of SIWE**
```typescript
// Agent uses API key (traditional auth)
const agent = new X402Client({
  apiKey: process.env.API_KEY, // Server-issued credential
  paymentSigner: agentWallet,
});

// Server checks API key instead of SIWE
server.onBeforeVerify(async ({ paymentPayload, requirements }) => {
  const apiKey = req.headers['x-api-key'];
  if (requirements.extensions?.auth?.required) {
    const user = await validateApiKey(apiKey);
    if (!user) {
      return { abort: true, reason: 'Invalid API key' };
    }
  }
});
```

**Solution 2: Delegated signing (EIP-712 permit)**
```typescript
// User signs delegation once (interactive)
const delegation = await userWallet.signTypedData({
  domain: { name: 'MyApp', version: '1' },
  types: {
    Delegation: [
      { name: 'agent', type: 'address' },
      { name: 'validUntil', type: 'uint256' },
    ],
  },
  message: {
    agent: agentAddress,
    validUntil: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  },
});

// Agent uses delegation for SIWE
const siweMessage = new SiweMessage({ ... });
const agentSignature = await agentWallet.signMessage(siweMessage.prepareMessage());

paymentPayload.extensions = {
  siwe: {
    message: siweMessage.prepareMessage(),
    signature: agentSignature,
    delegation: {
      delegator: userAddress,
      delegatee: agentAddress,
      signature: delegation,
    },
  },
};

// Server verifies delegation then agent signature
server.onBeforeVerify(async (context) => {
  const siwe = context.paymentPayload.extensions.siwe;

  // 1. Verify delegation signature
  const recoveredDelegator = verifyTypedData(siwe.delegation);

  // 2. Verify agent is delegatee
  if (recoveredDelegator !== siwe.delegation.delegator) {
    return { abort: true, reason: 'Invalid delegation' };
  }

  // 3. Verify agent's SIWE signature
  const siweResult = await verifySIWEAsAgent(siwe);
});
```

**Solution 3: Session sharing (JWT)**
```typescript
// User signs in, shares JWT with agent
const jwt = await userSignIn(); // Interactive SIWE

// Agent uses JWT (no interactive signing)
const agent = new X402Client({
  siweToken: jwt, // Pre-authorized
  paymentSigner: agentWallet,
});
```

**Comparison:**

| Approach | User Interaction | Security | Implementation |
|----------|------------------|----------|----------------|
| API Keys | One-time (issuance) | Traditional | Easy |
| Delegation | One-time (sign permit) | Strong (on-chain verifiable) | Complex |
| JWT Sharing | One-time (sign in) | Medium (bearer token) | Easy |

**Recommendation:**
1. **For internal agents:** API keys (simplest)
2. **For user-owned agents:** JWT sharing (good balance)
3. **For decentralized agents:** Delegation (most secure, most complex)

**x402 integration:**
```typescript
// Server supports multiple auth methods
server.onBeforeVerify(async ({ paymentPayload, requirements }) => {
  if (requirements.extensions?.auth?.required) {
    // Try API key first (agent-friendly)
    const apiKey = req.headers['x-api-key'];
    if (apiKey && await validateApiKey(apiKey)) {
      return; // Authorized
    }

    // Try SIWE (user-friendly)
    const siwe = paymentPayload.extensions?.siwe;
    if (siwe && await verifySIWE(siwe)) {
      return; // Authorized
    }

    // Try JWT (hybrid)
    const jwt = req.headers['authorization']?.replace('Bearer ', '');
    if (jwt && await verifyJWT(jwt)) {
      return; // Authorized
    }

    return { abort: true, reason: 'Authentication required' };
  }
});
```

---

## 6. Competitive Analysis

### Lightning LSAT (L402)

**Source:** [Lightning Labs LSAT](https://lightning.engineering/posts/2020-03-30-lsat/), [L402 Protocol](https://docs.lightning.engineering/the-lightning-network/l402)

**Architecture:**
```
┌─────────┐         ┌──────────┐         ┌─────────────┐
│ Client  │ ──402──▶│ Aperture │ ◀────── │  Protected  │
│         │ ◀─LSAT─ │  Proxy   │         │   Service   │
│         │         │          │         │             │
│         │ ─Pay───▶│ Lightning│         │             │
│         │ ◀Proof─ │  Node    │         │             │
│         │         └──────────┘         └─────────────┘
│         │ ─LSAT──▶
│         │ ◀─200──
└─────────┘
```

**Flow:**
1. **402 Challenge:** Client requests resource, gets 402 with LSAT challenge
2. **Invoice:** LSAT contains Lightning invoice + macaroon
3. **Payment:** Client pays invoice, receives preimage
4. **Token:** Client combines macaroon + preimage = LSAT token
5. **Authorization:** Client sends LSAT token in `Authorization` header
6. **Verification:** Server verifies preimage matches invoice's payment hash

**LSAT structure:**
```
LSAT macaroon=<base64>, invoice=<bolt11>
```

**Macaroon:** Cryptographic bearer credential with caveats
```typescript
interface Macaroon {
  identifier: string, // Maps to root key on server
  caveats: Caveat[], // Restrictions
  signature: string, // HMAC binding
}

interface Caveat {
  condition: string, // e.g., "expiration", "service", "user"
  value: any,
  comparison: '=' | '<' | '>', // For numeric caveats
}
```

**Example caveats:**
```javascript
// Time-based expiration
{ condition: 'expiration', value: 1735689600, comp: '<' }

// Service-level restriction
{ condition: 'service', value: 'premium', comp: '=' }

// Rate limiting
{ condition: 'rate', value: 100, comp: '<' }
```

**Comparison to x402:**

| Feature | LSAT | x402 |
|---------|------|------|
| Payment method | Lightning only | Multi-chain (EVM, SVM) |
| Auth mechanism | Macaroons | None (extensible) |
| Identity | Anonymous (preimage proves payment) | Optional (via SIWE) |
| Settlement | Instant (Lightning) | On-chain (minutes) |
| Token format | Macaroon + preimage | Payment signature |
| Attenuation | Yes (caveat chaining) | No (could add via extensions) |

**Key insight:** LSAT combines auth + payment atomically. The preimage is BOTH proof-of-payment AND authentication credential.

**LSAT advantages:**
- ✅ Instant payment (Lightning)
- ✅ Strong attenuation (macaroon caveats)
- ✅ Stateless verification
- ✅ Bearer token model (easy to share)

**LSAT disadvantages:**
- ❌ Lightning-only (no EVM, no Solana)
- ❌ No identity (can't distinguish payers)
- ❌ Bitcoin-centric

**Could x402 adopt macaroons?**
Yes, via extensions:
```typescript
{
  "accepts": [{ /* payment options */ }],
  "extensions": {
    "macaroon": {
      "identifier": "abc123",
      "caveats": [
        { "condition": "expiration", "value": 1735689600 },
      ],
      "signature": "def456",
    }
  }
}
```

This would give x402 LSAT-like attenuation without changing core protocol.

### Unlock Protocol

**Source:** [Unlock Protocol Docs](https://docs.unlock-protocol.com/), [Token-gated Architecture](https://docs.unlock-protocol.com/tutorials/building-token-gated-applications/)

**Architecture:**
```
┌─────────┐         ┌──────────┐         ┌─────────────┐
│ Client  │ ──────▶ │  Dapp    │ ◀────── │  PublicLock │
│ (Wallet)│ ◀────── │  Server  │ ─────▶  │  Contract   │
│         │         │          │         │  (on-chain) │
│         │         │          │         └─────────────┘
│         │         │  Checks: │
│         │         │  balance │
│         │         │  expiry  │
└─────────┘         └──────────┘
```

**Core concept:** Membership as time-bound NFTs

**PublicLock contract:**
```solidity
contract PublicLock {
  // Check if user has valid membership
  function balanceOf(address user) returns (uint256) {
    // Returns 0 if no key or expired
    // Returns >0 if valid key exists
  }

  // Get expiration timestamp
  function keyExpirationTimestampFor(address user) returns (uint256) {
    return keys[user].expirationTimestamp;
  }

  // Purchase membership
  function purchase(address recipient, ...) payable {
    // Mint NFT key with expiration
  }
}
```

**Authentication flow:**
```typescript
// 1. User connects wallet
const address = await wallet.getAddress();

// 2. Server checks NFT ownership
const lock = new ethers.Contract(LOCK_ADDRESS, PublicLock.abi, provider);
const balance = await lock.balanceOf(address);

if (balance > 0) {
  const expiry = await lock.keyExpirationTimestampFor(address);
  if (expiry > Date.now() / 1000) {
    // User has valid membership
    req.session.member = { address, expiry };
  }
}

// 3. Gate content
app.get('/members-only', (req, res) => {
  if (!req.session.member) {
    return res.status(403).json({ error: 'Membership required' });
  }
  res.json({ content: 'Premium content' });
});
```

**Comparison to x402:**

| Feature | Unlock | x402 |
|---------|--------|------|
| Payment model | Upfront (buy membership) | Per-use (micropayments) |
| Auth mechanism | NFT ownership | Optional (via SIWE) |
| Expiration | On-chain (in NFT) | Per-payment |
| Recurring | Yes (auto-renew) | No (pay-per-request) |
| Transferability | Yes (NFT can be sold) | No (payment is one-time) |

**Unlock advantages:**
- ✅ Membership model (one payment, many accesses)
- ✅ On-chain verification (no server trust)
- ✅ Transferable (can gift/sell memberships)
- ✅ Recurring revenue (renewals)

**Unlock disadvantages:**
- ❌ Upfront payment (no pay-as-you-go)
- ❌ Gas costs for minting NFTs
- ❌ Not suitable for micro-access (e.g., single API call)

**x402 + Unlock integration idea:**
```typescript
// Use Unlock for membership tiers, x402 for usage
app.use(paymentMiddleware({
  'GET /api/query': {
    accepts: {
      scheme: 'exact',
      network: 'eip155:8453',
      payTo: SERVER_ADDRESS,
      price: async (req) => {
        // Check Unlock membership
        const hasMembership = await checkUnlockMembership(
          req.headers['x-address'],
          LOCK_ADDRESS
        );

        if (hasMembership) {
          return { amount: '0', asset: 'FREE' }; // Free for members
        }

        return '$0.10'; // Non-members pay per use
      },
    },
  },
}));
```

This combines:
- **Unlock:** Membership/subscription model
- **x402:** Pay-per-use for non-members

### Other Approaches

**1. OAuth + Crypto**
- Rainbow.me, Dynamic.xyz, Privy
- Wallet-as-OAuth provider
- Social logins + wallet linking
- **Not payment-focused** - pure identity

**2. Lit Protocol (Decentralized Access Control)**
- Encrypt content with conditions
- "Only decrypt if user owns NFT X or has balance Y"
- **Complementary to x402** - could use x402 payment as decryption condition

**3. Web3Auth (Social Recovery + Wallet)**
- MPC wallets with social login
- No seed phrases
- **Identity layer only** - needs payment layer like x402

**4. SIWE-OIDC (Sign-In with Ethereum OpenID Connect)**
- SIWE as OAuth replacement
- Standardized identity provider
- **Similar to our SIWE integration** - could use for x402 auth

---

## 7. Recommendations

### Recommended Approach

**Phase 1: Extension-based SIWE (Minimal Core Changes)**

**Implementation plan:**

1. **Define SIWE extension schema:**
```typescript
// New file: packages/extensions/siwe/types.ts
export interface SIWEExtension {
  required: boolean;
  domain: string;
  nonce: string;
  statement?: string;
  chainId?: number;
  expirationTime?: string;
}

export interface SIWEProof {
  message: string; // Full SIWE message text
  signature: string; // Hex-encoded signature
}
```

2. **Create SIWE helper package:**
```typescript
// New package: @x402/extensions/siwe
import { SiweMessage } from 'siwe';

export function createSIWEChallenge(domain: string): SIWEExtension {
  return {
    required: true,
    domain,
    nonce: generateNonce(),
    statement: 'Sign in to access this resource',
  };
}

export async function verifySIWEProof(
  proof: SIWEProof,
  challenge: SIWEExtension
): Promise<{ success: boolean; address?: string; error?: string }> {
  try {
    const siwe = new SiweMessage(proof.message);
    const result = await siwe.verify({
      signature: proof.signature,
      nonce: challenge.nonce,
      domain: challenge.domain,
    });

    return { success: result.success, address: siwe.address };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

3. **Server-side hook for SIWE verification:**
```typescript
// Example integration in Express server
import { verifySIWEProof } from '@x402/extensions/siwe';

const server = new x402ResourceServer(facilitatorClient);

server.onBeforeVerify(async ({ paymentPayload, requirements }) => {
  const siweChallenge = requirements.extensions?.siwe as SIWEExtension;

  if (siweChallenge?.required) {
    const siweProof = paymentPayload.extensions?.siwe as SIWEProof;

    if (!siweProof) {
      return { abort: true, reason: 'SIWE authentication required' };
    }

    const result = await verifySIWEProof(siweProof, siweChallenge);

    if (!result.success) {
      return { abort: true, reason: `SIWE verification failed: ${result.error}` };
    }

    // Store verified address for use in route handlers
    // (can be accessed via context in afterVerify hooks)
    return { verifiedAddress: result.address };
  }
});
```

4. **Client-side SIWE integration:**
```typescript
// Modified wrapFetchWithPayment to handle SIWE
export function wrapFetchWithPayment(
  fetch: typeof globalThis.fetch,
  client: x402Client,
  options?: { siweProvider?: SIWEProvider }
) {
  return async (input, init) => {
    const response = await fetch(input, init);

    if (response.status === 402) {
      const paymentRequired = httpClient.getPaymentRequiredResponse(...);

      // Check if SIWE is required
      const siweChallenge = paymentRequired.extensions?.siwe;
      if (siweChallenge?.required && options?.siweProvider) {
        const siweProof = await options.siweProvider.signIn(siweChallenge);
        paymentPayload.extensions = {
          ...paymentPayload.extensions,
          siwe: siweProof,
        };
      }

      // Continue with payment...
    }
  };
}
```

**Phase 2: Tiered Pricing based on Identity**

Enable dynamic pricing based on verified address:

```typescript
app.use(paymentMiddleware({
  'GET /api/premium': {
    accepts: {
      scheme: 'exact',
      network: 'eip155:8453',
      payTo: SERVER_ADDRESS,
      price: async (context) => {
        // Access verified address from hook context
        const address = context.verifiedAddress;

        if (!address) return '$1.00'; // Anonymous

        // Check on-chain status
        const isDAOMember = await checkDAOMembership(address);
        const hasNFT = await checkNFTOwnership(address, NFT_ADDRESS);

        if (isDAOMember) return '$0.10'; // Member discount
        if (hasNFT) return '$0.50'; // NFT holder discount
        return '$1.00'; // Standard price
      },
    },
    extensions: {
      siwe: createSIWEChallenge('api.example.com'),
    },
  },
}));
```

**Phase 3: Session Management (Optional)**

For better UX, add session support:

```typescript
// New package: @x402/extensions/siwe-session
export class SIWESessionManager {
  constructor(private store: SessionStore) {}

  async createSession(address: string, chainId: number): Promise<string> {
    const token = generateJWT({
      sub: address,
      chainId,
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24h
    });

    await this.store.set(token, { address, chainId });
    return token;
  }

  async validateSession(token: string): Promise<{ address: string; chainId: number } | null> {
    return await this.store.get(token);
  }
}

// Integration with x402
server.onBeforeVerify(async ({ paymentPayload, requirements }) => {
  // Try session token first (if provided)
  const sessionToken = req.headers['x-siwe-session'];
  if (sessionToken) {
    const session = await siweSessionManager.validateSession(sessionToken);
    if (session) {
      return { verifiedAddress: session.address }; // Already authenticated
    }
  }

  // Fall back to per-request SIWE proof
  const siweChallenge = requirements.extensions?.siwe as SIWEExtension;
  if (siweChallenge?.required) {
    // ... verify SIWE proof as before
  }
});
```

### Implementation Phases

**Phase 1 (Weeks 1-2): Core SIWE Extension**
- [ ] Define extension schema
- [ ] Create `@x402/extensions/siwe` package
- [ ] Add server-side verification hooks
- [ ] Add client-side SIWE provider interface
- [ ] Write unit tests
- [ ] Document extension usage

**Phase 2 (Weeks 3-4): Examples and Integration**
- [ ] Add SIWE example to e2e tests
- [ ] Create demo app with SIWE + x402
- [ ] Add dynamic pricing example
- [ ] Add integration guides for popular wallets

**Phase 3 (Weeks 5-6): Advanced Features**
- [ ] Session management support
- [ ] Agent authentication patterns
- [ ] SIWS (Solana) support
- [ ] Unlock Protocol integration example

**Phase 4 (Weeks 7-8): Production Hardening**
- [ ] Security audit of SIWE integration
- [ ] Performance benchmarks
- [ ] Rate limiting integration
- [ ] Monitoring and logging

### Risks

**1. UX Complexity**
- **Risk:** Two signatures (SIWE + payment) = bad UX
- **Mitigation:** Use session-based SIWE, only sign once
- **Severity:** High

**2. Nonce Management**
- **Risk:** Nonce reuse or race conditions
- **Mitigation:** Use Redis or DB-backed nonce store with TTL
- **Severity:** Critical (security issue)

**3. Cross-chain Identity**
- **Risk:** User has address on Chain A but pays on Chain B
- **Mitigation:** Document that identity and payment can use different chains
- **Severity:** Medium

**4. AI Agent Compatibility**
- **Risk:** Agents can't do interactive SIWE signing
- **Mitigation:** Provide API key or delegation alternatives
- **Severity:** High (blocks agent use cases)

**5. Wallet Support**
- **Risk:** Not all wallets support personal_sign or signIn
- **Mitigation:** Feature detection and graceful fallback
- **Severity:** Medium

**6. Performance**
- **Risk:** SIWE verification adds latency (signature recovery)
- **Mitigation:** Cache verified addresses, use session tokens
- **Severity:** Low (signature recovery is ~10ms)

---

## 8. Next Steps

**Immediate (Next 2 Weeks):**

1. **Proof of Concept**
   - Build minimal SIWE extension in separate branch
   - Test with Express + MetaMask
   - Validate no core protocol changes needed

2. **Community Feedback**
   - Share research report with x402 maintainers
   - Gather feedback on extension schema
   - Identify use cases from community

3. **Spec Writing**
   - Draft extension specification
   - Define SIWE extension schema in detail
   - Write security considerations

**Short-term (Weeks 3-6):**

4. **Implementation**
   - Create `@x402/extensions/siwe` package
   - Add hook-based verification
   - Write comprehensive tests

5. **Documentation**
   - Integration guide for SIWE
   - Examples for common patterns
   - Security best practices

6. **Demo Application**
   - Build full-stack demo with SIWE + x402
   - Show tiered pricing based on identity
   - Include AI agent authentication example

**Long-term (Months 2-3):**

7. **SIWS Integration**
   - Add Solana support via Phantom's SIWS
   - Test with Solana Wallet Adapter
   - Document Solana-specific patterns

8. **Advanced Features**
   - Session management library
   - Integration with Unlock Protocol
   - Macaroon-style attenuation via extensions

9. **Production Adoption**
   - Partner with early adopters
   - Gather production feedback
   - Iterate based on real-world usage

---

## Appendix: Sources and References

### ERC-4361 / SIWE
- [Sign-In with Ethereum Overview](https://docs.login.xyz/general-information/siwe-overview/eip-4361)
- [EIP-4361 Specification](https://eips.ethereum.org/EIPS/eip-4361)
- [SIWE GitHub Repository](https://github.com/spruceid/siwe)
- [NextAuth.js SIWE Integration](https://docs.login.xyz/integrations/nextauth.js)
- [wagmi Sign-In with Ethereum Example](https://1.x.wagmi.sh/examples/sign-in-with-ethereum)

### CAIP-122 / Chain-Agnostic Sign-In
- [CAIP-122 Specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-122.md)
- [CAIP-74 (CACAO) Specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-74.md)
- [Solana CAIP-122 Namespace](https://namespaces.chainagnostic.org/solana/caip122)

### Sign-In with Solana (SIWS)
- [Phantom SIWS Documentation](https://phantom.com/learn/developers/sign-in-with-solana)
- [Phantom SIWS GitHub](https://github.com/phantom/sign-in-with-solana)
- [Solana Wallet Standard Sign-In](https://github.com/solana-labs/wallet-standard)
- [Phantom Launches SIWS Article](https://www.theblock.co/post/246683/phantom-sign-in-with-solana)
- [SIWS-RS Rust Implementation](https://github.com/pileks/siws-rs)
- [Phantom Authentication Standards Support](https://docs.phantom.com/developer-powertools/signing-a-message)

### Lightning LSAT (L402)
- [LSAT: Authentication and Payments](https://lightning.engineering/posts/2020-03-30-lsat/)
- [L402 Protocol Specification](https://docs.lightning.engineering/the-lightning-network/l402)
- [LSAT GitHub Repository](https://github.com/lightninglabs/LSAT)
- [lsat-js Library](https://github.com/Tierion/lsat-js)
- [Macaroons Documentation](https://github.com/lightninglabs/LSAT/blob/master/macaroons.md)
- [LSATs: Pseudonymous Authentication](https://medium.com/tierion/lsats-pseudonymous-authentication-using-bitcoin-lightning-payments-459e209b4b36)

### Unlock Protocol
- [Unlock Protocol Official Site](https://unlock-protocol.com/)
- [Unlock Technical Documentation](https://docs.unlock-protocol.com/)
- [Unlock Litepaper](https://docs.unlock-protocol.com/getting-started/what-is-unlock/litepaper)
- [Token-gated Application Architecture](https://docs.unlock-protocol.com/tutorials/building-token-gated-applications/)
- [Unlock WordPress Plugin](https://unlock-protocol.com/blog/unlock-protocol-wordpress-plugin)

### NextAuth.js Integration
- [NextAuth.js SIWE Integration](https://docs.login.xyz/integrations/nextauth.js)
- [RainbowKit SIWE NextAuth Package](https://www.npmjs.com/package/@rainbow-me/rainbowkit-siwe-next-auth)
- [Reown SIWE Documentation](https://docs.reown.com/appkit/next/core/siwe)
- [Family ConnectKit Auth Guide](https://docs.family.co/connectkit/auth-with-nextjs)

---

**Report End**
