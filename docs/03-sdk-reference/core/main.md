# Main Package Exports

Core constants and version information.

## Import

```typescript
import { x402Version } from '@x402/core';
```

## Exports

### x402Version

The current protocol version implemented by this package.

```typescript
export const x402Version = 2;
```

**Usage:**
```typescript
import { x402Version } from '@x402/core';

console.log('Protocol version:', x402Version); // 2

// Use in payment creation
const payment = await client.createPaymentPayload(
  x402Version,
  requirements
);

// Use in requirement building
const requirements = await service.buildPaymentRequirements(config);
console.log('Requirements version:', requirements[0].x402Version);
```

## Package Metadata

```json
{
  "name": "@x402/core",
  "version": "0.7.0",
  "description": "x402 Payment Protocol"
}
```

## Related Documentation

- [Type Definitions](./types.md) - Protocol types
- [x402Client](./client.md) - Client implementation
- [x402ResourceService](./server.md) - Server implementation
