# Reference Implementations

This directory contains documentation for x402 v2 reference implementations used for testing, integration examples, and protocol compliance verification.

## Overview

Reference implementations demonstrate how to integrate x402 v2 payment protocol into various languages and frameworks. They serve as:

- **Integration examples** - Show best practices for implementing clients and servers
- **Testing infrastructure** - Enable automated protocol compliance testing
- **Language templates** - Provide starting points for new language implementations
- **Protocol validation** - Verify the x402 protocol works across different tech stacks

All reference implementations are located in the `/e2e` directory and are part of the E2E test harness.

## Client Implementations

Client implementations demonstrate how to add x402 payment capabilities to HTTP clients.

### TypeScript Fetch Client

**Location**: `/e2e/clients/fetch/`
**Documentation**: [TypeScript Fetch Client](./typescript-fetch-client.md)

A reference implementation showing how to wrap the standard Fetch API with x402 payment handling using the TypeScript SDK.

**Features**:
- Automatic 402 response detection
- Payment payload creation
- Payment header injection
- Settlement receipt parsing

## Server Implementations

Server implementations demonstrate how to protect HTTP endpoints with x402 payment requirements.

### TypeScript Express Server

**Location**: `/e2e/servers/express/`
**Documentation**: [TypeScript Express Server](./typescript-express-server.md)

A reference implementation showing how to add x402 payment middleware to an Express.js application.

**Features**:
- Payment middleware integration
- Multiple endpoint protection
- Local facilitator integration
- Settlement response handling

## Facilitator Implementations

Facilitator implementations provide payment verification and settlement services.

### TypeScript Facilitator

**Location**: `/e2e/facilitators/typescript/`
**Documentation**: [TypeScript Facilitator](./typescript-facilitator.md)

A standalone HTTP facilitator service implementing the x402 v2 facilitator protocol in TypeScript.

**Features**:
- EVM payment verification
- On-chain settlement
- Bazaar extension support
- Discovery resource cataloging

**Protocol Families**: EVM
**x402 Versions**: v2

### Go Facilitator

**Location**: `/e2e/facilitators/go/`
**Documentation**: [Go Facilitator](./go-facilitator.md)

A high-performance standalone HTTP facilitator service implementing the x402 v2 facilitator protocol in Go.

**Features**:
- Real blockchain operations
- EIP-712 signature verification
- USDC settlement on Base Sepolia
- Transaction monitoring

**Protocol Families**: EVM
**x402 Versions**: v2

## Testing Infrastructure

### E2E Test Harness

**Location**: `/e2e/`
**Documentation**: [E2E Test Harness](./test-harness.md)

The E2E test harness automatically discovers and tests combinations of clients, servers, and facilitators.

**Features**:
- Automatic test discovery
- Cross-language testing
- Protocol compliance validation
- Integration testing

## Protocol Specification

All reference implementations comply with the x402 v2 protocol specifications:

- [Facilitator Protocol](../08-architecture/facilitator-protocol.md) - HTTP API specification for facilitators
- [Core Types](../03-sdk-reference/core/types.md) - TypeScript type definitions
- [Payment Flows](../02-protocol-flows/) - Complete payment protocol flows

## Implementation Matrix

| Implementation | Language | Type | Protocol Families | x402 Version | Extensions |
|---------------|----------|------|-------------------|--------------|------------|
| fetch | TypeScript | Client | EVM | v2 | - |
| express | TypeScript | Server | EVM | v2 | - |
| typescript | TypeScript | Facilitator | EVM | v2 | bazaar |
| go | Go | Facilitator | EVM | v2 | - |

## Adding New Implementations

To add a new reference implementation:

1. **Create implementation directory**:
   ```bash
   mkdir -p e2e/{clients|servers|facilitators}/your-impl
   ```

2. **Add test.config.json**:
   ```json
   {
     "name": "your-impl",
     "type": "client|server|facilitator",
     "language": "typescript|go|python",
     "protocolFamilies": ["evm"],
     "x402Versions": [2],
     "environment": {
       "required": ["ENV_VAR"],
       "optional": []
     }
   }
   ```

3. **Create run.sh**:
   ```bash
   #!/bin/bash
   # Script to run your implementation
   ```

4. **Implement required interfaces**:
   - **Clients**: Output JSON result to stdout
   - **Servers**: Implement `/health` and `/close` endpoints
   - **Facilitators**: Implement full facilitator protocol

5. **Test your implementation**:
   ```bash
   cd e2e
   pnpm test -d --client=your-impl  # or --server or --facilitator
   ```

6. **Document your implementation**:
   - Add documentation in `/docs/10-reference-implementations/`
   - Follow the structure of existing implementation docs

## Related Documentation

- [Getting Started](../00-getting-started/) - Introduction to x402 v2
- [Protocol Flows](../02-protocol-flows/) - Payment protocol sequences
- [SDK Reference](../03-sdk-reference/) - SDK API documentation
- [Implementation Guide](../05-implementation-guide/) - Step-by-step integration guide
- [Architecture](../08-architecture/) - Protocol architecture and decisions

## Testing and Development

For information on running and testing reference implementations, see:

- [CLAUDE.md](/CLAUDE.md) - Development environment setup
- [E2E Test Harness](./test-harness.md) - Test suite documentation
- [E2E README](/e2e/README.md) - E2E directory structure

## Support

Reference implementations are maintained as part of the x402 v2 protocol development. For questions or contributions:

- Review existing implementations for patterns
- Check the E2E test harness for integration examples
- Consult protocol specifications for requirements
- See [Contributing Guide](../../CONTRIBUTING.md) for contribution guidelines
