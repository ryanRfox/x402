<!-- VERIFIED: 3c3e2168 -->
# Appendix

Supplementary documentation for the x402 protocol and SDK.

## Contents

- [Glossary](./glossary.md) - Terms and definitions
- [Environment Setup](./environment-setup.md) - Detailed environment configuration
- [Production](./production.md) - Production deployment guide
- [Roadmap](./roadmap.md) - Public roadmap and contribution opportunities
- [Running Tests](./running-tests.md) - E2E test execution

## Quick Reference

### Network Identifiers

| Network | CAIP-2 Identifier |
|---------|-------------------|
| Base Mainnet | `eip155:8453` |
| Base Sepolia | `eip155:84532` |
| Ethereum Mainnet | `eip155:1` |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d` |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |

### HTTP Headers

| Header | Direction | Description |
|--------|-----------|-------------|
| `PAYMENT-SIGNATURE` | Request | Base64-encoded payment payload |
| `PAYMENT-REQUIRED` | Response (402) | Base64-encoded payment requirements |
| `PAYMENT-RESPONSE` | Response (200) | Base64-encoded settlement result |

### Packages

| Package | Description |
|---------|-------------|
| `@x402/core` | Core types and classes |
| `@x402/express` | Express.js middleware |
| `@x402/fetch` | Fetch wrapper |
| `@x402/axios` | Axios interceptor |
| `@x402/hono` | Hono middleware |
| `@x402/next` | Next.js middleware |
| `@x402/evm` | EVM payment scheme |
| `@x402/svm` | Solana payment scheme |

### Default Ports

| Service | Port |
|---------|------|
| Resource Server | 4021 |
| Facilitator | 4022 |

### Environment Variables

| Variable | Component | Description |
|----------|-----------|-------------|
| `EVM_PRIVATE_KEY` | Client/Facilitator | EVM private key |
| `SVM_PRIVATE_KEY` | Client/Facilitator | Solana private key |
| `EVM_PAYEE_ADDRESS` | Server | EVM payment recipient |
| `SVM_PAYEE_ADDRESS` | Server | Solana payment recipient |
| `FACILITATOR_URL` | Server | Facilitator service URL |
