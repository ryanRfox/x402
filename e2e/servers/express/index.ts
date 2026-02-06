import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import dotenv from "dotenv";

dotenv.config();

/**
 * Express E2E Test Server with x402 Payment Middleware
 *
 * This server demonstrates how to integrate x402 payment middleware
 * with an Express application for end-to-end testing.
 */

const PORT = process.env.PORT || "4021";
const EVM_NETWORK = (process.env.EVM_NETWORK || "eip155:84532") as `${string}:${string}`;
const SVM_NETWORK = (process.env.SVM_NETWORK ||
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1") as `${string}:${string}`;
const EVM_PAYEE_ADDRESS = process.env.EVM_PAYEE_ADDRESS as `0x${string}`;
const SVM_PAYEE_ADDRESS = process.env.SVM_PAYEE_ADDRESS as string;
const facilitatorUrl = process.env.FACILITATOR_URL;

if (!EVM_PAYEE_ADDRESS) {
  console.error("❌ EVM_PAYEE_ADDRESS environment variable is required");
  process.exit(1);
}

if (!SVM_PAYEE_ADDRESS) {
  console.error("❌ SVM_PAYEE_ADDRESS environment variable is required");
  process.exit(1);
}

if (!facilitatorUrl) {
  console.error("❌ FACILITATOR_URL environment variable is required");
  process.exit(1);
}

// Initialize Express app
const app = express();

// Create HTTP facilitator client
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

// Create x402 resource server
const server = new x402ResourceServer(facilitatorClient);

// Register server schemes
registerExactEvmScheme(server);
registerExactSvmScheme(server);

// Register Bazaar discovery extension
server.registerExtension(bazaarResourceServerExtension);

console.log(
  `Facilitator account: ${process.env.EVM_PRIVATE_KEY ? process.env.EVM_PRIVATE_KEY.substring(0, 10) + "..." : "not configured"}`,
);
console.log(`Using remote facilitator at: ${facilitatorUrl}`);

/**
 * Configure x402 payment middleware using builder pattern
 *
 * This middleware protects endpoints with $0.001 USDC payment requirements
 * on Base Sepolia and Solana Devnet with bazaar discovery extension.
 */
app.use(
  paymentMiddleware(
    {
      // Route-specific payment configuration
      "GET /protected-eip3009": {
        accepts: {
          payTo: EVM_PAYEE_ADDRESS,
          scheme: "exact",
          price: "$0.001",
          network: EVM_NETWORK,
        },
        extensions: {
          ...declareDiscoveryExtension({
            output: {
              example: {
                message: "EIP-3009 endpoint accessed successfully",
                timestamp: "2024-01-01T00:00:00Z",
              },
              schema: {
                properties: {
                  message: { type: "string" },
                  timestamp: { type: "string" },
                },
                required: ["message", "timestamp"],
              },
            },
          }),
        },
      },
      "GET /protected-svm": {
        accepts: {
          payTo: SVM_PAYEE_ADDRESS,
          scheme: "exact",
          price: "$0.001",
          network: SVM_NETWORK,
        },
        extensions: {
          ...declareDiscoveryExtension({
            output: {
              example: {
                message: "Protected endpoint accessed successfully",
                timestamp: "2024-01-01T00:00:00Z",
              },
              schema: {
                properties: {
                  message: { type: "string" },
                  timestamp: { type: "string" },
                },
                required: ["message", "timestamp"],
              },
            },
          }),
        },
      },
      // Multi-mechanism endpoint - accepts EIP-3009 (USDC) and Permit2 (WETH) payments
      "GET /protected": {
        accepts: [
          // USDC via EIP-3009 (default stablecoin resolution)
          {
            payTo: EVM_PAYEE_ADDRESS,
            scheme: "exact",
            price: "$0.001",
            network: EVM_NETWORK,
          },
          // WETH via Permit2 (non-EIP-3009 token demonstrating Permit2's value)
          {
            payTo: EVM_PAYEE_ADDRESS,
            scheme: "exact",
            network: EVM_NETWORK,
            price: {
              amount: "1000000000000", // 1e12 = 0.000001 WETH (18 decimals, ~$0.003 at $3k ETH)
              asset: "0x4200000000000000000000000000000000000006", // Base Sepolia WETH
              extra: {
                assetTransferMethod: "permit2",
              },
            },
          },
        ],
        extensions: {
          ...declareDiscoveryExtension({
            output: {
              example: {
                message: "Multi-mechanism endpoint accessed successfully",
                timestamp: "2024-01-01T00:00:00Z",
                method: "multi",
              },
              schema: {
                properties: {
                  message: { type: "string" },
                  timestamp: { type: "string" },
                  method: { type: "string" },
                },
                required: ["message", "timestamp", "method"],
              },
            },
          }),
        },
      },
      // Permit2 endpoint - explicitly requires Permit2 flow instead of EIP-3009
      "GET /protected-permit2": {
        accepts: {
          payTo: EVM_PAYEE_ADDRESS,
          scheme: "exact",
          network: EVM_NETWORK,
          // Use pre-parsed price with assetTransferMethod to force Permit2
          price: {
            amount: "1000", // 0.001 USDC (6 decimals)
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
            extra: {
              assetTransferMethod: "permit2",
            },
          },
        },
        extensions: {
          ...declareDiscoveryExtension({
            output: {
              example: {
                message: "Permit2 endpoint accessed successfully",
                timestamp: "2024-01-01T00:00:00Z",
                method: "permit2",
              },
              schema: {
                properties: {
                  message: { type: "string" },
                  timestamp: { type: "string" },
                  method: { type: "string" },
                },
                required: ["message", "timestamp", "method"],
              },
            },
          }),
        },
      },
    },
    server, // Pass pre-configured server instance
  ),
);

/**
 * Multi-mechanism endpoint - accepts multiple payment methods
 *
 * This endpoint demonstrates the v2 protocol's payment negotiation capability
 * by accepting USDC via EIP-3009 and WETH via Permit2.
 * The client SDK auto-selects from the accepts array.
 */
app.get("/protected", (req, res) => {
  res.json({
    message: "Multi-mechanism endpoint accessed successfully",
    timestamp: new Date().toISOString(),
    method: "multi",
  });
});

/**
 * Protected EIP-3009 endpoint - requires payment via EIP-3009 flow
 *
 * This endpoint demonstrates a resource protected by x402 payment middleware
 * using the EIP-3009 transfer-with-authorization flow.
 */
app.get("/protected-eip3009", (req, res) => {
  res.json({
    message: "EIP-3009 endpoint accessed successfully",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Protected SVM endpoint - requires payment to access
 *
 * This endpoint demonstrates a resource protected by x402 payment middleware for SVM.
 * Clients must provide a valid payment signature to access this endpoint.
 */
app.get("/protected-svm", (req, res) => {
  res.json({
    message: "Protected endpoint accessed successfully",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Protected Permit2 endpoint - requires payment via Permit2 flow
 *
 * This endpoint demonstrates the Permit2 payment flow.
 * Clients must have approved Permit2 to spend their USDC before accessing.
 */
app.get("/protected-permit2", (req, res) => {
  res.json({
    message: "Permit2 endpoint accessed successfully",
    timestamp: new Date().toISOString(),
    method: "permit2",
  });
});

/**
 * Health check endpoint - no payment required
 *
 * Used to verify the server is running and responsive.
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    network: EVM_NETWORK,
    payee: EVM_PAYEE_ADDRESS,
    version: "2.0.0",
  });
});

/**
 * Shutdown endpoint - used by e2e tests
 *
 * Allows graceful shutdown of the server during testing.
 */
app.post("/close", (req, res) => {
  res.json({ message: "Server shutting down gracefully" });
  console.log("Received shutdown request");

  // Give time for response to be sent
  setTimeout(() => {
    process.exit(0);
  }, 100);
});

// Start the server
app.listen(parseInt(PORT), () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║           x402 Express E2E Test Server                 ║
╠════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${PORT}                  ║
║  EVM Network:    ${EVM_NETWORK}                         ║
║  SVM Network:    ${SVM_NETWORK}                         ║
║  EVM Payee:      ${EVM_PAYEE_ADDRESS}                   ║
║  SVM Payee:      ${SVM_PAYEE_ADDRESS}                   ║
║                                                        ║
║  Endpoints:                                            ║
║  • GET  /protected         (multi-mechanism)          ║
║  • GET  /protected-eip3009 (EIP-3009 payment)         ║
║  • GET  /protected-svm     (SVM payment)              ║
║  • GET  /protected-permit2 (Permit2 payment)          ║
║  • GET  /health            (no payment required)      ║
║  • POST /close             (shutdown server)          ║
╚════════════════════════════════════════════════════════╝
  `);
});
