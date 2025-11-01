# x402Client

The `x402Client` class is the core client-side implementation for creating and managing payment payloads in the x402 protocol. It handles payment scheme registration, requirement selection, and payment payload creation.

## Overview

`x402Client` provides a unified interface for clients to:
- Register payment scheme implementations (EVM, Solana, custom)
- Select compatible payment requirements from server responses
- Create payment payloads for selected requirements
- Support multiple protocol versions and networks

## Import

```typescript
import { x402Client } from '@x402/core/client';
```

## Class Definition

```typescript
export class x402Client {
  constructor(
    paymentRequirementsSelector?: SelectPaymentRequirements
  );

  registerScheme(
    network: Network,
    client: SchemeNetworkClient
  ): x402Client;

  selectPaymentRequirements(
    x402Version: number,
    paymentRequirements: PaymentRequirements[]
  ): PaymentRequirements;

  createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements
  ): Promise<PaymentPayload>;
}
```

## Constructor

### Parameters

- **paymentRequirementsSelector** (optional): Custom logic for selecting from multiple payment options
  - Type: `(x402Version: number, paymentRequirements: PaymentRequirements[]) => PaymentRequirements`
  - Default: Returns the first option `accepts[0]`

### Default Behavior

If no selector is provided, the client defaults to selecting the first payment requirement:

```typescript
const client = new x402Client();
// Uses: (x402Version, accepts) => accepts[0]
```

### Custom Selection

Provide custom logic for selecting payment requirements:

```typescript
const client = new x402Client((x402Version, accepts) => {
  // Prefer lowest cost option
  return accepts.reduce((min, curr) =>
    parseFloat(curr.amount) < parseFloat(min.amount) ? curr : min
  );
});
```

## Methods

### registerScheme()

Registers a payment scheme implementation for a specific network or network pattern.

```typescript
registerScheme(
  network: Network,
  client: SchemeNetworkClient
): x402Client
```

#### Parameters

- **network**: Network identifier or pattern (e.g., `eip155:8453`, `eip155:*`, `solana:mainnet`)
- **client**: Implementation of `SchemeNetworkClient` interface

#### Returns

Returns `this` for method chaining.

#### Examples

```typescript
import { ExactEvmClient } from '@x402/evm';
import { SolanaClient } from '@x402/svm';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');
const client = new x402Client();

// Register for all EVM chains
client.registerScheme('eip155:*', new ExactEvmClient(account));

// Register for specific Solana network
client.registerScheme('solana:mainnet', new SolanaClient(wallet));

// Chain multiple registrations
client
  .registerScheme('eip155:8453', new BaseClient())
  .registerScheme('eip155:1', new EthereumClient())
  .registerScheme('solana:devnet', new SolanaDevnetClient());
```

#### Network Pattern Matching

The client supports wildcard patterns for network families:

```typescript
// Matches any EIP-155 network (Ethereum, Base, Optimism, etc.)
client.registerScheme('eip155:*', evmClient);

// Matches specific chain ID
client.registerScheme('eip155:8453', baseClient);

// Specific match takes precedence over wildcard
client
  .registerScheme('eip155:*', defaultEvmClient)
  .registerScheme('eip155:8453', optimizedBaseClient);
// Requests to eip155:8453 will use optimizedBaseClient
```

### selectPaymentRequirements()

Selects a compatible payment requirement from the options provided by a server.

```typescript
selectPaymentRequirements(
  x402Version: number,
  paymentRequirements: PaymentRequirements[]
): PaymentRequirements
```

#### Parameters

- **x402Version**: Protocol version (typically `2`)
- **paymentRequirements**: Array of payment options from server's `accepts` field

#### Returns

A single `PaymentRequirements` object that:
1. Matches a registered payment scheme
2. Matches a registered network (including pattern matches)
3. Passes the custom selector function (if provided)

#### Throws

- `Error` if no client is registered for the x402 version
- `Error` if no registered schemes match any of the payment requirements

#### Examples

```typescript
// After receiving 402 response
const response = await fetch(url);
if (response.status === 402) {
  const paymentRequired = JSON.parse(
    response.headers.get('PAYMENT-REQUIRED')
  );

  const selected = client.selectPaymentRequirements(
    paymentRequired.x402Version,
    paymentRequired.accepts
  );

  console.log('Selected payment:', selected);
  // {
  //   scheme: 'exact',
  //   network: 'eip155:8453',
  //   amount: '100000',
  //   asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  //   payTo: '0x...',
  //   maxTimeoutSeconds: 300,
  //   extra: { ... }
  // }
}
```

### createPaymentPayload()

Creates a payment payload for the selected requirements.

```typescript
createPaymentPayload(
  x402Version: number,
  requirements: PaymentRequirements
): Promise<PaymentPayload>
```

#### Parameters

- **x402Version**: Protocol version (typically `2`)
- **requirements**: Selected payment requirements

#### Returns

A `Promise` that resolves to a `PaymentPayload` containing:
- Protocol version
- Payment scheme and network
- Signed payment data
- Accepted requirements
- Optional extensions

#### Throws

- `Error` if no client is registered for the x402 version
- `Error` if no client is registered for the scheme/network combination

#### Examples

```typescript
const requirements = client.selectPaymentRequirements(
  2,
  paymentRequired.accepts
);

const payment = await client.createPaymentPayload(2, requirements);

console.log(payment);
// {
//   x402Version: 2,
//   scheme: 'exact',
//   network: 'eip155:8453',
//   payload: {
//     signature: '0x...',
//     message: { ... }
//   },
//   accepted: { /* full requirements */ }
// }
```

## Internal Architecture

### Scheme Registry

The client maintains a nested map structure for registered schemes:

```
Map<x402Version, Map<network, Map<scheme, SchemeNetworkClient>>>
```

This enables:
- Version-specific scheme implementations
- Network pattern matching (wildcards)
- Multiple schemes per network

### Selection Algorithm

When selecting payment requirements:

1. **Filter by compatibility**: Only include requirements that match registered schemes
2. **Pattern matching**: Check exact network matches first, then wildcard patterns
3. **Apply selector**: Use custom or default selection logic

## Complete Example

```typescript
import { x402Client } from '@x402/core/client';
import { ExactEvmClient } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

// Setup
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const client = new x402Client((x402Version, accepts) => {
  // Custom logic: prefer mainnet over testnet
  const mainnetOptions = accepts.filter(
    req => !req.network.includes('sepolia')
  );
  return mainnetOptions.length > 0 ? mainnetOptions[0] : accepts[0];
});

// Register payment schemes
client.registerScheme('eip155:*', new ExactEvmClient(account));

// Make request
const makeProtectedRequest = async (url: string) => {
  let response = await fetch(url);

  // Handle payment requirement
  if (response.status === 402) {
    const paymentRequiredHeader = response.headers.get('PAYMENT-REQUIRED');
    if (!paymentRequiredHeader) {
      throw new Error('No payment required header');
    }

    const paymentRequired = JSON.parse(
      Buffer.from(paymentRequiredHeader, 'base64').toString('utf-8')
    );

    // Select and create payment
    const selected = client.selectPaymentRequirements(
      paymentRequired.x402Version,
      paymentRequired.accepts
    );

    const payment = await client.createPaymentPayload(
      paymentRequired.x402Version,
      selected
    );

    // Encode payment header
    const paymentHeader = Buffer.from(
      JSON.stringify(payment)
    ).toString('base64');

    // Retry with payment
    response = await fetch(url, {
      headers: {
        'PAYMENT-SIGNATURE': paymentHeader
      }
    });
  }

  return response;
};

// Use
const response = await makeProtectedRequest('https://api.example.com/data');
const data = await response.json();
```

## Error Handling

### No Registered Client

```typescript
try {
  const payment = await client.createPaymentPayload(2, requirements);
} catch (error) {
  // Error: No client registered for x402 version: 2
  console.error('Client not configured for protocol version:', error);
}
```

### No Matching Scheme

```typescript
try {
  const selected = client.selectPaymentRequirements(
    2,
    paymentRequired.accepts
  );
} catch (error) {
  // Error: No network/scheme registered which comply with payment requirements
  console.error('Server requires unsupported payment method:', error);

  // Error includes diagnostic info:
  // {
  //   x402Version: 2,
  //   paymentRequirements: [...],
  //   x402Versions: [2],
  //   networks: ['eip155:*'],
  //   schemes: ['exact']
  // }
}
```

## Integration with HTTP Clients

For HTTP-specific functionality, use `x402HTTPClient`:

```typescript
import { x402HTTPClient } from '@x402/core/client';

const client = new x402HTTPClient();

// Same registration
client.registerScheme('eip155:*', new ExactEvmClient(account));

// Additional HTTP methods
const headers = client.encodePaymentSignatureHeader(payment);
// { 'PAYMENT-SIGNATURE': 'base64...' }

const paymentRequired = client.getPaymentRequiredResponse(
  responseHeaders,
  responseBody
);

const settlementResponse = client.getPaymentSettleResponse(responseHeaders);
```

See [HTTP Client Extensions](./http-client.md) for details.

## Type Reference

### Network

```typescript
type Network = `${string}:${string}`;
// Examples: 'eip155:8453', 'solana:mainnet'
```

### SelectPaymentRequirements

```typescript
type SelectPaymentRequirements = (
  x402Version: number,
  paymentRequirements: PaymentRequirements[]
) => PaymentRequirements;
```

### SchemeNetworkClient

```typescript
interface SchemeNetworkClient {
  readonly scheme: string;
  createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements
  ): Promise<PaymentPayload>;
}
```

## Best Practices

### 1. Register All Networks

Register payment schemes for all networks your application supports:

```typescript
const client = new x402Client();

// Production networks
client.registerScheme('eip155:1', new ExactEvmClient(mainnetAccount));
client.registerScheme('eip155:8453', new ExactEvmClient(baseAccount));
client.registerScheme('solana:mainnet', new SolanaClient(mainnetWallet));

// Testnet networks (for development)
if (process.env.NODE_ENV === 'development') {
  client.registerScheme('eip155:84532', new ExactEvmClient(testAccount));
  client.registerScheme('solana:devnet', new SolanaClient(devWallet));
}
```

### 2. Use Wildcards for Consistency

Use wildcard patterns when the same implementation works across a network family:

```typescript
// Instead of registering each EVM chain separately:
client
  .registerScheme('eip155:1', evmClient)
  .registerScheme('eip155:8453', evmClient)
  .registerScheme('eip155:10', evmClient);

// Use a wildcard:
client.registerScheme('eip155:*', evmClient);
```

### 3. Implement Smart Selection

Provide a selector that matches your business logic:

```typescript
const client = new x402Client((x402Version, accepts) => {
  // Prefer lower costs
  const sorted = accepts.sort((a, b) =>
    parseFloat(a.amount) - parseFloat(b.amount)
  );

  // But filter out unfavorable networks
  const filtered = sorted.filter(req =>
    !EXPENSIVE_NETWORKS.includes(req.network)
  );

  return filtered[0] || sorted[0];
});
```

### 4. Handle Errors Gracefully

```typescript
const makePayment = async () => {
  try {
    const selected = client.selectPaymentRequirements(
      x402Version,
      accepts
    );
    return await client.createPaymentPayload(x402Version, selected);
  } catch (error) {
    if (error.message.includes('No network/scheme registered')) {
      // Show user friendly message
      showError('This content requires a payment method you don\'t have');
    } else {
      // Log unexpected errors
      logger.error('Payment creation failed', error);
    }
    throw error;
  }
};
```

## Related Documentation

- [x402HTTPClient](./http-client.md) - HTTP-specific client methods
- [Payment Types](./types.md#payment-types) - Type definitions
- [EVM Client](../mechanisms/evm.md#client) - Ethereum implementation
- [SVM Client](../mechanisms/svm.md#client) - Solana implementation
