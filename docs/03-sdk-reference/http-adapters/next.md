# @x402/next (Coming Soon)

Next.js middleware and route protection for x402 payments.

## Status

🚧 **Planned** - This package is not yet implemented.

## Planned Features

- App Router middleware
- API route protection
- Server Actions support
- RSC compatibility
- Edge Runtime support

## Expected API

### Middleware

```typescript
import { withPayment } from '@x402/next';

export default withPayment({
  '/api/premium/:path*': {
    scheme: 'exact',
    payTo: '0x...',
    price: '$0.10',
    network: 'eip155:8453'
  }
});

export const config = {
  matcher: '/api/premium/:path*'
};
```

### API Routes

```typescript
import { protectRoute } from '@x402/next';

export const GET = protectRoute(
  async (request) => {
    return Response.json({ data: 'premium' });
  },
  {
    scheme: 'exact',
    payTo: '0x...',
    price: '$0.10',
    network: 'eip155:8453'
  }
);
```

## Current Workaround

Use core implementation in route handlers:

```typescript
import { x402HTTPResourceService } from '@x402/core/server';

const service = new x402HTTPResourceService(routes);
await service.initialize();

export async function GET(request: Request) {
  const result = await service.processHTTPRequest({
    adapter: {
      getHeader: (name) => request.headers.get(name) || undefined,
      getMethod: () => 'GET',
      getPath: () => new URL(request.url).pathname,
      getUrl: () => request.url,
      getAcceptHeader: () => request.headers.get('accept') || '',
      getUserAgent: () => request.headers.get('user-agent') || ''
    },
    path: new URL(request.url).pathname,
    method: 'GET'
  });

  if (result.type === 'payment-verified') {
    const data = { message: 'success' };
    const settlement = await service.processSettlement(
      result.paymentPayload,
      result.requirements,
      200
    );

    return Response.json(data, {
      headers: settlement || {}
    });
  } else if (result.type === 'payment-error') {
    return new Response(result.response.body, {
      status: result.response.status,
      headers: result.response.headers
    });
  }

  return Response.json({ message: 'No payment required' });
}
```

## Contributing

Interested in implementing this adapter? See [Contributing Guide](../../08-architecture/contributing.md).
