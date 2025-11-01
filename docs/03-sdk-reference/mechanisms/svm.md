# @x402/svm (Coming Soon)

Solana Virtual Machine (SVM) payment mechanisms for the x402 protocol.

## Status

🚧 **Planned** - This package is not yet implemented.

## Planned Features

- Ed25519 signature support
- SPL Token transfers
- Solana Program integration
- Support for Mainnet, Devnet, and Testnet
- USDC on Solana as default payment token

## Expected Components

### ExactSvmClient

Creates payment signatures using Solana wallets:

```typescript
import { ExactSvmClient } from '@x402/svm';
import { Keypair } from '@solana/web3.js';

const keypair = Keypair.fromSecretKey(/* ... */);
const client = new ExactSvmClient(keypair);

client.registerScheme('solana:mainnet', client);
```

### ExactSvmFacilitator

Verifies and settles SPL Token payments:

```typescript
import { ExactSvmFacilitator } from '@x402/svm';

const facilitator = new ExactSvmFacilitator(connection, payer);

await facilitator.verify(paymentPayload, requirements);
await facilitator.settle(paymentPayload, requirements);
```

### ExactSvmService

Parses prices and builds Solana-specific requirements:

```typescript
import { ExactSvmService } from '@x402/svm';

const service = new ExactSvmService();
service.parsePrice('$0.10', 'solana:mainnet');
// => { amount: '100000', asset: 'USDC mint address', extra: {} }
```

## Expected Payment Structure

```typescript
{
  x402Version: 2,
  scheme: 'exact',
  network: 'solana:mainnet',
  payload: {
    transaction: /* base64 encoded transaction */,
    signature: /* Ed25519 signature */
  },
  accepted: { /* requirements */ }
}
```

## Current Workaround

Until `@x402/svm` is available, you can implement custom Solana payment logic using the core interfaces:

```typescript
import {
  SchemeNetworkClient,
  SchemeNetworkFacilitator,
  SchemeNetworkService
} from '@x402/core/types';
import { Connection, Keypair } from '@solana/web3.js';

class CustomSolanaClient implements SchemeNetworkClient {
  readonly scheme = 'exact';

  constructor(private keypair: Keypair) {}

  async createPaymentPayload(version, requirements) {
    // Implement Solana payment creation
    // 1. Build SPL Token transfer transaction
    // 2. Sign with keypair
    // 3. Return PaymentPayload
  }
}

// Register with client
client.registerScheme('solana:mainnet', new CustomSolanaClient(keypair));
```

## Contributing

Interested in implementing this package? See [Contributing Guide](../../08-architecture/contributing.md).

Key tasks:
- [ ] SPL Token transfer implementation
- [ ] Ed25519 signature verification
- [ ] Solana connection management
- [ ] Transaction building and submission
- [ ] Network configuration (mainnet/devnet/testnet)
- [ ] USDC mint address management
- [ ] Error handling and retries
- [ ] Integration tests

## Related Documentation

- [EVM Implementation](./evm.md) - Reference implementation
- [Core Interfaces](../core/types.md) - Interface definitions
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) - Solana JavaScript API
- [SPL Token](https://spl.solana.com/token) - Solana token program
