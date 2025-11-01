# @x402/hono (Coming Soon)

Hono framework middleware for x402 payment requirements.

## Status

🚧 **Planned** - This package is not yet implemented.

## Planned Features

- Hono middleware for route protection
- Edge-compatible (Cloudflare Workers, Deno, Bun)
- Minimal bundle size
- Streaming support

## Expected API

```typescript
import { Hono } from 'hono';
import { paymentMiddleware } from '@x402/hono';
import { ExactEvmService } from '@x402/evm';

const app = new Hono();

app.use('/premium/*', paymentMiddleware({
  scheme: 'exact',
  payTo: '0x...',
  price: '$0.10',
  network: 'eip155:8453'
}, {
  schemes: [{ network: 'eip155:8453', server: new ExactEvmService() }]
}));

app.get('/premium/data', (c) => {
  return c.json({ data: 'premium' });
});
```

## Current Workaround

Use core implementation directly:

```typescript
import { Hono } from 'hono';
import { x402HTTPResourceService } from '@x402/core/server';

const service = new x402HTTPResourceService(routes);

app.use('*', async (c, next) => {
  const adapter = {
    getHeader: (name) => c.req.header(name),
    getMethod: () => c.req.method,
    getPath: () => new URL(c.req.url).pathname,
    getUrl: () => c.req.url,
    getAcceptHeader: () => c.req.header('accept') || '',
    getUserAgent: () => c.req.header('user-agent') || ''
  };

  const result = await service.processHTTPRequest({
    adapter,
    path: new URL(c.req.url).pathname,
    method: c.req.method
  });

  if (result.type === 'payment-verified') {
    await next();
  } else if (result.type === 'payment-error') {
    return c.newResponse(result.response.body, {
      status: result.response.status,
      headers: result.response.headers
    });
  } else {
    await next();
  }
});
```

## Contributing

Interested in implementing this adapter? See [Contributing Guide](../../08-architecture/contributing.md).
