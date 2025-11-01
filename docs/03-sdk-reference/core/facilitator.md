# x402Facilitator

The `x402Facilitator` class provides a local implementation of payment verification and settlement. It's useful for self-hosted facilitators or testing environments where you want full control over the payment flow.

## Overview

`x402Facilitator` enables you to:
- Verify payment signatures locally
- Settle payments on-chain
- Run a self-hosted facilitator service
- Test payment flows without external dependencies

## Import

```typescript
import { x402Facilitator } from '@x402/core/facilitator';
```

## Class Definition

```typescript
export class x402Facilitator {
  registerScheme(
    network: Network,
    facilitator: SchemeNetworkFacilitator
  ): x402Facilitator;

  verify(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<VerifyResponse>;

  settle(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<SettleResponse>;
}
```

## Methods

### registerScheme()

Registers a payment scheme implementation for verification and settlement.

```typescript
registerScheme(
  network: Network,
  facilitator: SchemeNetworkFacilitator
): x402Facilitator
```

#### Examples

```typescript
import { x402Facilitator } from '@x402/core/facilitator';
import { ExactEvmFacilitator } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

const facilitator = new x402Facilitator();
const signerAccount = privateKeyToAccount('0x...');

facilitator.registerScheme(
  'eip155:8453',
  new ExactEvmFacilitator(signerAccount)
);
```

### verify()

Verifies a payment payload against requirements.

```typescript
verify(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse>
```

#### Returns

```typescript
interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}
```

#### Examples

```typescript
const verifyResult = await facilitator.verify(
  paymentPayload,
  paymentRequirements
);

if (verifyResult.isValid) {
  console.log('Payment from:', verifyResult.payer);
} else {
  console.error('Invalid:', verifyResult.invalidReason);
}
```

### settle()

Settles a verified payment on-chain.

```typescript
settle(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<SettleResponse>
```

#### Returns

```typescript
interface SettleResponse {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: Network;
}
```

#### Examples

```typescript
const settleResult = await facilitator.settle(
  paymentPayload,
  paymentRequirements
);

if (settleResult.success) {
  console.log('Settled:', settleResult.transaction);
}
```

## Complete Example

```typescript
import { x402Facilitator } from '@x402/core/facilitator';
import { ExactEvmFacilitator } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

// Setup facilitator
const facilitator = new x402Facilitator();
const signerAccount = privateKeyToAccount(
  process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`
);

facilitator.registerScheme(
  'eip155:8453',
  new ExactEvmFacilitator(signerAccount)
);

// Use in server
import { x402ResourceService } from '@x402/core/server';

class LocalFacilitatorClient implements FacilitatorClient {
  async verify(payload, requirements) {
    return facilitator.verify(payload, requirements);
  }

  async settle(payload, requirements) {
    return facilitator.settle(payload, requirements);
  }

  async getSupported() {
    return {
      kinds: [{
        x402Version: 2,
        scheme: 'exact',
        network: 'eip155:8453'
      }],
      extensions: []
    };
  }
}

const service = new x402ResourceService(
  new LocalFacilitatorClient()
);
```

## Use Cases

### 1. Self-Hosted Facilitator

Run your own facilitator service instead of relying on third parties:

```typescript
import express from 'express';
import { x402Facilitator } from '@x402/core/facilitator';

const app = express();
const facilitator = new x402Facilitator();

// Register schemes
facilitator.registerScheme('eip155:8453', new ExactEvmFacilitator(signer));

// Verify endpoint
app.post('/verify', async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body;
  const result = await facilitator.verify(paymentPayload, paymentRequirements);
  res.json(result);
});

// Settle endpoint
app.post('/settle', async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body;
  const result = await facilitator.settle(paymentPayload, paymentRequirements);
  res.json(result);
});

app.listen(3001);
```

### 2. Testing

Use local facilitator for integration tests:

```typescript
import { x402Facilitator } from '@x402/core/facilitator';

describe('Payment Flow', () => {
  const facilitator = new x402Facilitator();

  beforeAll(() => {
    facilitator.registerScheme('eip155:8453', mockFacilitator);
  });

  it('should verify valid payment', async () => {
    const result = await facilitator.verify(validPayload, requirements);
    expect(result.isValid).toBe(true);
  });
});
```

### 3. Custom Payment Logic

Implement custom verification rules:

```typescript
class CustomFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = 'custom';

  async verify(payload, requirements) {
    // Custom verification logic
    const isValid = await this.validateSignature(payload);
    const meetsMinimum = parseFloat(requirements.amount) >= 100000;

    return {
      isValid: isValid && meetsMinimum,
      invalidReason: !meetsMinimum ? 'Amount too low' : undefined,
      payer: this.extractPayer(payload)
    };
  }

  async settle(payload, requirements) {
    // Custom settlement logic
    const txHash = await this.settleOnChain(payload, requirements);
    return {
      success: true,
      transaction: txHash,
      network: requirements.network,
      payer: this.extractPayer(payload)
    };
  }
}

facilitator.registerScheme('custom:network', new CustomFacilitator());
```

## Related Documentation

- [HTTP Facilitator Client](./facilitator-client.md) - Remote facilitator client
- [x402ResourceService](./server.md) - Server implementation
- [EVM Facilitator](../mechanisms/evm.md#facilitator) - Ethereum implementation
