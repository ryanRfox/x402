# Utility Functions

Helper functions for the x402 core package.

## Import

```typescript
import {
  findSchemesByNetwork,
  findByNetworkAndScheme,
  safeBase64Encode,
  safeBase64Decode,
  deepEqual,
  Base64EncodedRegex
} from '@x402/core/utils';
```

## Network Utilities

### findSchemesByNetwork()

Finds all payment schemes registered for a network, including pattern matches.

```typescript
function findSchemesByNetwork<T>(
  map: Map<string, Map<string, T>>,
  network: Network
): Map<string, T> | undefined
```

**Example:**
```typescript
const implementations = findSchemesByNetwork(registeredSchemes, 'eip155:8453');
// Returns schemes for 'eip155:8453' or 'eip155:*'
```

### findByNetworkAndScheme()

Finds a specific scheme implementation for a network.

```typescript
function findByNetworkAndScheme<T>(
  map: Map<string, Map<string, T>>,
  scheme: string,
  network: Network
): T | undefined
```

**Example:**
```typescript
const implementation = findByNetworkAndScheme(
  registeredSchemes,
  'exact',
  'eip155:8453'
);
```

## Encoding Utilities

### safeBase64Encode()

Environment-aware base64 encoding (browser or Node.js).

```typescript
function safeBase64Encode(data: string): string
```

**Example:**
```typescript
const encoded = safeBase64Encode(JSON.stringify(payment));
```

### safeBase64Decode()

Environment-aware base64 decoding (browser or Node.js).

```typescript
function safeBase64Decode(data: string): string
```

**Example:**
```typescript
const decoded = safeBase64Decode(headerValue);
const payment = JSON.parse(decoded);
```

### Base64EncodedRegex

Validation regex for base64-encoded strings.

```typescript
const Base64EncodedRegex = /^[A-Za-z0-9+/]*={0,2}$/;
```

**Example:**
```typescript
if (Base64EncodedRegex.test(headerValue)) {
  const decoded = safeBase64Decode(headerValue);
}
```

## Comparison Utilities

### deepEqual()

Deep equality comparison for payment requirements.

```typescript
function deepEqual(obj1: any, obj2: any): boolean
```

**Features:**
- Handles nested objects and arrays
- Normalizes property order
- Handles null/undefined
- Safe error handling

**Example:**
```typescript
const matches = deepEqual(paymentPayload.accepted, paymentRequirements);
if (matches) {
  console.log('Payment matches requirements');
}
```

## Related Documentation

- [x402Client](./client.md) - Client implementation
- [x402ResourceService](./server.md) - Server implementation
- [HTTP Utilities](./http.md) - HTTP encoding functions
