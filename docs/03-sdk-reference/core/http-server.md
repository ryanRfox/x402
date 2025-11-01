# x402HTTPResourceService

HTTP-enhanced resource service with framework-agnostic middleware capabilities.

## Overview

`x402HTTPResourceService` extends `x402ResourceService` with HTTP-specific features:
- Route pattern matching
- HTTP header extraction
- Paywall HTML generation
- Framework adapter interface

## Import

```typescript
import { x402HTTPResourceService } from '@x402/core/server';
```

## Class Definition

```typescript
export class x402HTTPResourceService extends x402ResourceService {
  constructor(
    routes: RoutesConfig,
    facilitatorClients?: FacilitatorClient | FacilitatorClient[]
  );

  async processHTTPRequest(
    context: HTTPRequestContext,
    paywallConfig?: PaywallConfig
  ): Promise<HTTPProcessResult>;

  async processSettlement(
    paymentPayload: PaymentPayload,
    requirements: any,
    responseStatus: number
  ): Promise<Record<string, string> | null>;
}
```

## Types

### RoutesConfig

```typescript
type RoutesConfig = Record<string, RouteConfig> | RouteConfig;

interface RouteConfig {
  scheme: string;
  payTo: string;
  price: Price;
  network: Network;
  maxTimeoutSeconds?: number;

  // HTTP-specific
  resource?: string;
  description?: string;
  mimeType?: string;
  customPaywallHtml?: string;
  discoverable?: boolean;
  inputSchema?: any;
  outputSchema?: any;
}
```

### HTTPAdapter

```typescript
interface HTTPAdapter {
  getHeader(name: string): string | undefined;
  getMethod(): string;
  getPath(): string;
  getUrl(): string;
  getAcceptHeader(): string;
  getUserAgent(): string;
}
```

### HTTPProcessResult

```typescript
type HTTPProcessResult =
  | { type: 'no-payment-required' }
  | { type: 'payment-verified'; paymentPayload: PaymentPayload; requirements: any }
  | { type: 'payment-error'; response: HTTPResponseInstructions };
```

## Constructor

### Route Patterns

```typescript
// Single route
new x402HTTPResourceService({
  scheme: 'exact',
  payTo: '0x...',
  price: '$0.10',
  network: 'eip155:8453'
});

// Multiple routes
new x402HTTPResourceService({
  'GET /api/data': {
    scheme: 'exact',
    payTo: '0x...',
    price: '$0.10',
    network: 'eip155:8453',
    description: 'API data endpoint',
    mimeType: 'application/json'
  },
  'POST /api/compute': {
    scheme: 'exact',
    payTo: '0x...',
    price: '$1.00',
    network: 'eip155:8453'
  },
  '/premium/*': {
    scheme: 'exact',
    payTo: '0x...',
    price: '$0.50',
    network: 'eip155:8453'
  }
});
```

### Pattern Syntax

- `GET /path` - Specific method and path
- `/path` - Any method
- `/path/*` - Wildcard
- `/path/[id]` - Parameter placeholder

## Methods

### processHTTPRequest()

Main entry point for processing HTTP requests.

```typescript
async processHTTPRequest(
  context: HTTPRequestContext,
  paywallConfig?: PaywallConfig
): Promise<HTTPProcessResult>
```

**Example:**
```typescript
const adapter: HTTPAdapter = {
  getHeader: (name) => req.headers.get(name),
  getMethod: () => req.method,
  getPath: () => new URL(req.url).pathname,
  getUrl: () => req.url,
  getAcceptHeader: () => req.headers.get('accept') || '',
  getUserAgent: () => req.headers.get('user-agent') || ''
};

const result = await service.processHTTPRequest({
  adapter,
  path: req.url.pathname,
  method: req.method
});

if (result.type === 'payment-verified') {
  // Process request
} else if (result.type === 'payment-error') {
  return new Response(result.response.body, {
    status: result.response.status,
    headers: result.response.headers
  });
}
```

### processSettlement()

Settles payment after successful response.

```typescript
async processSettlement(
  paymentPayload: PaymentPayload,
  requirements: any,
  responseStatus: number
): Promise<Record<string, string> | null>
```

**Example:**
```typescript
if (result.type === 'payment-verified') {
  const response = await handler(req);

  const settlementHeaders = await service.processSettlement(
    result.paymentPayload,
    result.requirements,
    response.status
  );

  if (settlementHeaders) {
    Object.entries(settlementHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}
```

## Complete Example

```typescript
import { x402HTTPResourceService } from '@x402/core/server';
import { ExactEvmService } from '@x402/evm';

const service = new x402HTTPResourceService({
  'GET /api/data': {
    scheme: 'exact',
    payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    price: '$0.10',
    network: 'eip155:8453',
    description: 'Premium API data',
    mimeType: 'application/json'
  }
});

service.registerScheme('eip155:8453', new ExactEvmService());
await service.initialize();

async function handleRequest(req: Request): Promise<Response> {
  const adapter: HTTPAdapter = {
    getHeader: (name) => req.headers.get(name) || undefined,
    getMethod: () => req.method,
    getPath: () => new URL(req.url).pathname,
    getUrl: () => req.url,
    getAcceptHeader: () => req.headers.get('accept') || '',
    getUserAgent: () => req.headers.get('user-agent') || ''
  };

  const result = await service.processHTTPRequest({
    adapter,
    path: new URL(req.url).pathname,
    method: req.method
  });

  switch (result.type) {
    case 'no-payment-required':
      return new Response('Not protected', { status: 200 });

    case 'payment-error':
      return new Response(result.response.body, {
        status: result.response.status,
        headers: result.response.headers
      });

    case 'payment-verified': {
      const data = { message: 'Success', timestamp: Date.now() };
      const response = new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      const settlementHeaders = await service.processSettlement(
        result.paymentPayload,
        result.requirements,
        response.status
      );

      if (settlementHeaders) {
        Object.entries(settlementHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }

      return response;
    }
  }
}
```

## Paywall Configuration

For browser requests, configure the paywall UI:

```typescript
const result = await service.processHTTPRequest(context, {
  cdpClientKey: process.env.CDP_CLIENT_KEY,
  appName: 'My App',
  appLogo: 'https://example.com/logo.png',
  sessionTokenEndpoint: '/api/session',
  currentUrl: req.url,
  testnet: process.env.NODE_ENV === 'development'
});
```

## Related Documentation

- [x402ResourceService](./server.md) - Base server implementation
- [Express Integration](../http-adapters/express.md) - Express middleware
- [Next.js Integration](../http-adapters/next.md) - Next.js routes
- [Hono Integration](../http-adapters/hono.md) - Hono middleware
