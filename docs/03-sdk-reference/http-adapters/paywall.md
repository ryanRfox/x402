# @x402/paywall (Coming Soon)

React component for x402 payment paywalls.

## Status

🚧 **Planned** - This package is not yet implemented.

## Planned Features

- React component for payment UI
- Wallet connection integration
- Payment status tracking
- Customizable styling
- Mobile-friendly

## Expected API

```typescript
import { Paywall } from '@x402/paywall';

function PremiumContent() {
  return (
    <Paywall
      resourceUrl="https://api.example.com/premium/data"
      onPaymentComplete={(data) => console.log(data)}
      config={{
        appName: 'My App',
        appLogo: '/logo.png',
        testnet: true
      }}
    >
      <PremiumDataDisplay />
    </Paywall>
  );
}
```

## Current Workaround

Implement custom paywall using `@x402/fetch`:

```typescript
import { useState } from 'react';
import { wrapFetchWithPayment } from '@x402/fetch';

function Paywall({ children, resourceUrl }) {
  const [hasPaid, setHasPaid] = useState(false);
  const [error, setError] = useState(null);

  const handlePayment = async () => {
    try {
      const fetchWithPayment = wrapFetchWithPayment(fetch, { schemes });
      const response = await fetchWithPayment(resourceUrl);

      if (response.ok) {
        setHasPaid(true);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (!hasPaid) {
    return (
      <div>
        <h2>Payment Required</h2>
        <button onClick={handlePayment}>Pay $0.10</button>
        {error && <p>Error: {error}</p>}
      </div>
    );
  }

  return children;
}
```

## Contributing

Interested in implementing this component? See [Contributing Guide](../../08-architecture/contributing.md).
