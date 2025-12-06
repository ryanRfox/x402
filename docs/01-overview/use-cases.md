<!-- VERIFIED: 0aa62c64 -->

# Use Cases

x402 enables real-time micropayments for HTTP APIs using blockchain settlement. This document explores practical applications where x402's pay-per-request model provides significant advantages over traditional payment systems.

## API Monetization

Traditional API monetization relies on subscription tiers or prepaid credits. x402 enables true pay-per-call pricing with immediate settlement, eliminating billing complexity and enabling granular access control.

**Why x402 is a good fit:**
- No upfront subscriptions required
- Automatic payment enforcement at the HTTP layer
- Zero revenue leakage from free tiers
- Instant access for new users with wallet

```typescript
const routes = {
  "GET /api/data": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.01",
    },
    description: "Premium data endpoint - $0.01 per request",
  },
  "POST /api/analytics": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.05",
    },
    description: "Analytics processing - $0.05 per request",
  },
};
```

## AI/ML Model Access

AI inference endpoints have variable costs per request. x402 allows providers to charge based on model complexity, input size, or compute time without complex metering infrastructure.

**Why x402 is a good fit:**
- Direct cost pass-through to users
- No need for credit systems or rate limits
- Supports dynamic pricing based on model tier
- Enables instant access to expensive models

```typescript
const routes = {
  "POST /inference/gpt-4": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.10",
    },
    description: "GPT-4 inference - $0.10 per request",
  },
  "POST /inference/whisper": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.02",
    },
    description: "Whisper transcription - $0.02 per minute",
  },
};
```

## Premium Content Access

Digital content providers can monetize individual assets without subscription barriers. Users pay only for content they consume, reducing friction and increasing access.

**Why x402 is a good fit:**
- Micropayments for individual articles, images, or datasets
- No subscription lock-in
- Instant content delivery upon payment
- Works globally without traditional payment infrastructure

```typescript
const routes = {
  "GET /content/article/:id": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.25",
    },
    description: "Premium article access - $0.25 per article",
  },
  "GET /data/research/:dataset": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$1.00",
    },
    description: "Research dataset - $1.00 per download",
  },
};
```

## Pay-Per-Use Services

Cloud services, compute resources, and storage can be priced by actual usage rather than reserved capacity. x402 enables granular billing without complex metering systems.

**Why x402 is a good fit:**
- Real-time payment for consumed resources
- No prepaid capacity planning
- Reduces waste from overprovisioning
- Enables spot pricing for compute

```typescript
const routes = {
  "POST /compute/render": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.50",
    },
    description: "Image rendering - $0.50 per job",
  },
  "POST /storage/upload": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.001",
    },
    description: "File storage - $0.001 per MB/month",
  },
};
```

## Microtransactions

Traditional payment systems have minimum transaction sizes due to processing fees. x402 enables true microtransactions for fractional cent use cases.

**Why x402 is a good fit:**
- No minimum payment threshold
- Blockchain settlement handles small amounts efficiently
- Enables new business models impossible with card payments
- Instant finality without chargeback risk

```typescript
const routes = {
  "GET /api/quote": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.0001",
    },
    description: "Market quote - $0.0001 per request",
  },
  "POST /api/validate": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.0005",
    },
    description: "Data validation - $0.0005 per check",
  },
};
```

## Agent-to-Agent Payments

Autonomous AI agents need to transact with each other without human intervention. x402 provides a programmatic payment protocol that agents can implement directly.

**Why x402 is a good fit:**
- No human-in-the-loop for payments
- Programmatic discovery via OPTIONS requests
- Agents can budget and optimize API spending
- Enables emergent agent economies

```typescript
const routes = {
  "POST /agent/task": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.10",
    },
    description: "Agent task execution - $0.10 per task",
  },
  "GET /agent/status/:jobId": {
    accepts: {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      price: "$0.001",
    },
    description: "Job status query - $0.001 per check",
  },
};
```

## Benefits Across All Use Cases

x402's architecture provides consistent advantages:

- **Immediate monetization**: No payment gateway setup or merchant accounts
- **Global access**: Blockchain payments work across borders without currency conversion
- **Zero fraud risk**: Payment is verified before service delivery
- **No billing complexity**: Protocol handles payment enforcement
- **Transparent pricing**: Users see costs upfront via OPTIONS discovery
- **Programmable**: Ideal for automated systems and AI agents

## Implementation Considerations

When designing x402 services:

- Set prices that reflect actual costs plus margin
- Use OPTIONS discovery to communicate pricing clearly
- Consider network fees in your pricing model
- Test with target networks (mainnet vs testnet costs differ)
- Implement proper error handling for payment failures
- Monitor blockchain congestion impacts on user experience
