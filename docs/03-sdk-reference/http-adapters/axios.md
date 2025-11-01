# @x402/axios (Coming Soon)

Axios interceptor for automatic x402 payment handling.

## Status

🚧 **Planned** - This package is not yet implemented.

## Planned Features

- Axios request/response interceptor
- Automatic 402 handling
- Configuration via axios defaults
- Compatible with existing axios instances

## Expected API

```typescript
import axios from 'axios';
import { withPayment } from '@x402/axios';
import { ExactEvmClient } from '@x402/evm';

const client = withPayment(axios.create(), {
  schemes: [
    { network: 'eip155:*', client: new ExactEvmClient(account) }
  ]
});

const response = await client.get('https://api.example.com/premium');
```

## Current Workaround

Use `@x402/fetch` with a fetch-to-axios adapter:

```typescript
import { wrapFetchWithPayment } from '@x402/fetch';
import axios from 'axios';

const fetchWithPayment = wrapFetchWithPayment(fetch, { schemes });

// Use fetch instead of axios for payment-protected endpoints
const response = await fetchWithPayment(url);
```

## Contributing

Interested in implementing this adapter? See [Contributing Guide](../../08-architecture/contributing.md).
