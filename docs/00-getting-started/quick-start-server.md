<!-- VERIFIED: 0aa62c64 -->
# Server Quick Start

This guide walks you through building an Express server with x402 payment requirements. You'll create endpoints that require payment before granting access.

## What You'll Build

An Express server with:
- A protected endpoint requiring payment
- Automatic payment verification via facilitator
- Route-based payment configuration

## Prerequisites

- Node.js 18 or later
- An EVM wallet address to receive payments

## Installation

Install the required packages:

```bash
pnpm add express @x402/express @x402/evm dotenv
pnpm add -D @types/express tsx
```

## Implementation

### Step 1: Create the Server

Create a file `server.ts`:

```typescript
import { config } from "dotenv";
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

config();

const app = express();

// Your wallet address to receive payments
const PAYEE_ADDRESS = process.env.PAYEE_ADDRESS as `0x${string}`;

// Initialize the facilitator client
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org"
});

// Create the x402 resource server
const server = new x402ResourceServer(facilitatorClient);

// Register the EVM payment scheme
registerExactEvmScheme(server);

// Configure protected routes
app.use(
  paymentMiddleware(
    {
      "GET /protected": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532", // Base Sepolia testnet
          payTo: PAYEE_ADDRESS,
          price: "$0.001",
        },
        description: "Protected content requiring payment",
      },
    },
    server
  )
);

// Define the protected endpoint
app.get("/protected", (req, res) => {
  res.json({
    message: "Payment successful! Here's your protected content.",
    timestamp: new Date().toISOString()
  });
});

// Public endpoint (no payment required)
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Protected endpoint: http://localhost:${PORT}/protected`);
  console.log(`Payments go to: ${PAYEE_ADDRESS}`);
});
```

### Step 2: Configure Environment

Create a `.env` file:

```bash
PAYEE_ADDRESS=0xYourWalletAddress
PORT=3000
```

Replace `0xYourWalletAddress` with your actual Ethereum address.

### Step 3: Run the Server

```bash
npx tsx server.ts
```

Your server is now running on `http://localhost:3000`.

## Testing Your Server

### Test the Public Endpoint

```bash
curl http://localhost:3000/
```

Response:
```json
{"status":"ok","message":"Server is running"}
```

### Test the Protected Endpoint Without Payment

```bash
curl -i http://localhost:3000/protected
```

Response:
```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64-encoded payment requirements>

{"error":"Payment required"}
```

### Test With a Client

To access the protected endpoint with payment, use an x402 client. See the [Client Quick Start](./quick-start-client.md) guide.

## Route Configuration

The `paymentMiddleware` accepts a route configuration object:

```typescript
{
  "METHOD /path": {
    accepts: {
      scheme: string,      // Payment scheme ("exact")
      network: string,     // Blockchain network (CAIP-2 format)
      payTo: string,       // Recipient address
      price: string,       // Price (e.g., "$0.001")
    },
    description: string,   // Human-readable description
  }
}
```

### Network Identifiers

Use CAIP-2 format for network identifiers:

| Network | Identifier |
|---------|------------|
| Base Sepolia (testnet) | `eip155:84532` |
| Base Mainnet | `eip155:8453` |
| Ethereum Mainnet | `eip155:1` |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |

### Price Formats

Supported price formats:

- Fiat: `"$0.001"`, `"$1.50"`
- With decimals: `"$0.0001"`

### Multiple Protected Routes

Protect multiple routes with different prices:

```typescript
app.use(
  paymentMiddleware(
    {
      "GET /basic": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532",
          payTo: PAYEE_ADDRESS,
          price: "$0.001",
        },
        description: "Basic tier content",
      },
      "GET /premium": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532",
          payTo: PAYEE_ADDRESS,
          price: "$0.01",
        },
        description: "Premium tier content",
      },
      "POST /api/compute": {
        accepts: {
          scheme: "exact",
          network: "eip155:84532",
          payTo: PAYEE_ADDRESS,
          price: "$0.05",
        },
        description: "Compute endpoint",
      },
    },
    server
  )
);
```

### Multiple Payment Options

Accept payments on multiple networks:

```typescript
app.use(
  paymentMiddleware(
    {
      "GET /multi-chain": {
        accepts: [
          {
            scheme: "exact",
            network: "eip155:84532",
            payTo: evmAddress,
            price: "$0.001",
          },
          {
            scheme: "exact",
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            payTo: solanaAddress,
            price: "$0.001",
          },
        ],
        description: "Multi-chain endpoint",
      },
    },
    server
  )
);
```

## Understanding the Components

### HTTPFacilitatorClient

Connects to the x402 facilitator to verify and settle payments:

```typescript
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org"
});
```

### x402ResourceServer

Core server instance that handles payment verification:

```typescript
const server = new x402ResourceServer(facilitatorClient);
```

### Payment Schemes

Register payment schemes your server accepts:

```typescript
// For EVM (Ethereum, Base, etc.)
registerExactEvmScheme(server);

// For Solana
import { registerExactSvmScheme } from "@x402/svm/exact/server";
registerExactSvmScheme(server);
```

## Next Steps

- [Client Quick Start](./quick-start-client.md) - Build a client to test your server
- [Architecture Overview](../01-overview/architecture-overview.md) - Understand the x402 protocol
- [Express Package Reference](../03-sdk-reference/http-adapters/express.md) - Full middleware documentation
