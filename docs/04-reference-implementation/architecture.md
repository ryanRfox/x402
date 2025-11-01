# Reference Implementation Architecture

Overview of the TypeScript reference implementation structure and organization.

## Package Structure

```
x402/
├── typescript/packages/
│   ├── core/                  # Framework-agnostic core logic
│   │   ├── src/types/        # Type definitions
│   │   ├── src/client/       # Client base classes
│   │   ├── src/server/       # Server base classes
│   │   ├── src/facilitator/  # Facilitator implementation
│   │   ├── src/http/         # HTTP-specific logic
│   │   └── src/utils/        # Shared utilities
│   ├── http/                  # HTTP framework integrations
│   │   ├── fetch/            # Fetch API wrapper (client)
│   │   ├── express/          # Express middleware (server)
│   │   ├── hono/             # Hono middleware (server)
│   │   └── next/             # Next.js integration (server)
│   └── mechanisms/            # Payment scheme implementations
│       ├── evm/              # EVM networks (Base, Ethereum, etc.)
│       └── svm/              # Solana networks
└── e2e/                       # Reference implementations & tests
    ├── clients/fetch/        # Reference client
    ├── servers/express/      # Reference server
    └── src/                  # Test harness
```

## Core Abstractions

### Client Layer

```mermaid
classDiagram
    x402Client <|-- x402HTTPClient
    x402HTTPClient <-- wrapFetchWithPayment
    x402Client --> SchemeNetworkClient
    ExactEvmClient ..|> SchemeNetworkClient

    class x402Client {
        +registerScheme()
        +selectPaymentRequirements()
        +createPaymentPayload()
    }

    class x402HTTPClient {
        +encodePaymentSignatureHeader()
        +getPaymentRequiredResponse()
        +getPaymentSettleResponse()
    }

    class SchemeNetworkClient {
        <<interface>>
        +createPaymentPayload()
    }
```

### Server Layer

```mermaid
classDiagram
    x402ResourceService <|-- x402HTTPResourceService
    x402HTTPResourceService <-- paymentMiddleware
    x402HTTPResourceService --> SchemeNetworkService
    ExactEvmService ..|> SchemeNetworkService

    class x402ResourceService {
        +buildPaymentRequirements()
        +verifyPayment()
        +settlePayment()
    }

    class x402HTTPResourceService {
        +processHTTPRequest()
        +processSettlement()
    }

    class SchemeNetworkService {
        <<interface>>
        +parsePrice()
        +enhancePaymentRequirements()
    }
```

## Reference Implementation

### Client (`e2e/clients/fetch/`)

**Purpose**: Demonstrates how to wrap HTTP clients with x402 payment handling

**Key Files**:
- `index.ts` - Entry point using `@x402/fetch`
- `test.config.json` - Test configuration
- `run.sh` - Execution script

See: [Client Architecture](./client-architecture.md)

### Server (`e2e/servers/express/`)

**Purpose**: Demonstrates how to protect endpoints with payment requirements

**Key Files**:
- `index.ts` - Express app with payment middleware
- `facilitator.ts` - Local facilitator configuration
- `test.config.json` - Test configuration
- `run.sh` - Execution script

See: [Server Architecture](./server-architecture.md)

### Test Harness (`e2e/src/`)

**Purpose**: Automated testing framework for client/server combinations

**Key Files**:
- `test.ts` - Main test runner
- `discovery.ts` - Automatic implementation discovery
- `proxy-base.ts` - Process management
- `clients/generic-client.ts` - Client proxy
- `servers/generic-server.ts` - Server proxy

See: [Test Harness](./test-harness.md)

## Design Patterns

### 1. Framework Agnostic Core

Core logic is independent of HTTP frameworks:

```typescript
// Core defines interfaces
interface HTTPAdapter {
  getHeader(name: string): string | undefined;
  // ...
}

// Express provides implementation
class ExpressAdapter implements HTTPAdapter {
  constructor(private req: Request) {}
  getHeader(name: string) { return this.req.header(name); }
}

// Hono provides implementation
class HonoAdapter implements HTTPAdapter {
  constructor(private c: Context) {}
  getHeader(name: string) { return this.c.req.header(name); }
}
```

### 2. Scheme Registration

Payment schemes are registered at runtime:

```typescript
// Client-side
const client = new x402HTTPClient();
client.registerScheme("eip155:8453", new ExactEvmClient(signer));
client.registerScheme("solana:mainnet", new ExactSolanaClient(signer));

// Server-side
const server = new x402HTTPResourceService(routes);
server.registerScheme("eip155:8453", new ExactEvmService());
server.registerScheme("solana:mainnet", new ExactSolanaService());
```

### 3. Local vs Remote Facilitators

Facilitators can run locally or remotely:

```typescript
// Local facilitator (reference implementation)
const facilitator = new x402Facilitator();
facilitator.registerScheme("eip155:8453", new ExactEvmFacilitator(signer));
const client = new LocalFacilitatorClient(facilitator);

// Remote facilitator (theoretical)
const client = new HTTPFacilitatorClient("https://facilitator.x402.org");

// Both implement FacilitatorClient interface
paymentMiddleware(routes, client);
```

## Data Flow

### Request Processing Flow

```mermaid
flowchart TD
    Request[HTTP Request] --> Middleware[Payment Middleware]
    Middleware --> Context[Create HTTPRequestContext]
    Context --> Process[processHTTPRequest]

    Process --> Match{Route<br/>Match?}
    Match -->|No| NoPayment[no-payment-required]
    Match -->|Yes| Extract[Extract Payment Header]

    Extract --> Build[Build Requirements]
    Build --> Payment{Payment<br/>Present?}

    Payment -->|No| Error402[payment-error<br/>402 Response]
    Payment -->|Yes| Verify[Verify Payment]

    Verify --> Valid{Valid?}
    Valid -->|No| Error402
    Valid -->|Yes| Verified[payment-verified]

    Verified --> Handler[Execute Route Handler]
    Handler --> Success{Success<br/>Status?}

    Success -->|4xx/5xx| Skip[Skip Settlement]
    Success -->|2xx/3xx| Settle[Settle Payment]

    Settle --> Response[Add Settlement Headers]
    Response --> Return[Return Response]
    Skip --> Return

    NoPayment --> Next[Call next]

    style NoPayment fill:#90EE90
    style Verified fill:#90EE90
    style Error402 fill:#FFB6C1
```

## Next Steps

- **Client Details**: [Client Architecture](./client-architecture.md)
- **Server Details**: [Server Architecture](./server-architecture.md)
- **Testing**: [Test Harness](./test-harness.md)

---

*Reference: `/e2e/` and `typescript/packages/`*
