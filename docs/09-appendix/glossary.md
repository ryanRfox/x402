<!-- VERIFIED: 3c3e2168 -->
# Glossary

Key terms and definitions used in the x402 protocol.

## Protocol Terms

### x402

The HTTP payment protocol that extends HTTP 402 Payment Required with blockchain-based payments. x402 enables programmatic micropayments for API access.

### 402 Payment Required

HTTP status code indicating that payment is required to access a resource. The x402 protocol uses this status code to initiate the payment flow.

### Payment Payload

A JSON object containing a signed payment authorization from the client. Sent in the `PAYMENT-SIGNATURE` header as base64-encoded data.

### Payment Requirements

The payment options accepted by a server for accessing a resource. Includes scheme, network, asset, amount, and recipient address.

### Payment Required Response

The server's 402 response containing payment options in the `PAYMENT-REQUIRED` header. Includes available payment methods and resource information.

## Architecture Terms

### Client

The application making HTTP requests to protected resources. Clients sign payment authorizations locally using their wallet.

### Resource Server

The server hosting protected resources. Resource servers verify payments through a facilitator and settle after serving content.

### Facilitator

A service that verifies payment signatures off-chain and executes settlement transactions on-chain. Facilitators abstract blockchain complexity from resource servers.

### Hosted Facilitator

The public facilitator service at `https://facilitator.x402.org`. Handles verification and settlement for supported networks.

### Self-Hosted Facilitator

A custom facilitator deployed for specific requirements like private networks, custom settlement logic, or full control.

## Payment Scheme Terms

### Payment Scheme

A module defining how payments are signed, verified, and settled for a specific mechanism. Examples: `exact` for EIP-3009/SPL transfers.

### Exact Scheme

The built-in payment scheme using exact token transfers. Uses EIP-3009 on EVM chains and SPL Token transfers on Solana.

### EIP-3009

Ethereum Improvement Proposal for gasless token transfers using `transferWithAuthorization`. Allows pre-signed transfers without the sender paying gas.

### TransferWithAuthorization

The EIP-3009 function that transfers tokens using a signature. The facilitator calls this function to execute EVM payments.

### SPL Token

Solana Program Library token standard. The Solana equivalent of ERC-20 tokens on Ethereum.

## Network Terms

### CAIP-2

Chain Agnostic Improvement Proposal 2. A standard format for blockchain network identifiers: `namespace:reference`.

### Network Identifier

A CAIP-2 formatted string identifying a blockchain network. Examples:
- `eip155:84532` - Base Sepolia
- `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` - Solana Devnet

### EVM

Ethereum Virtual Machine. The runtime environment for smart contracts on Ethereum and compatible chains (Base, Polygon, etc.).

### SVM

Solana Virtual Machine. The runtime environment for programs on Solana.

### Chain ID

A numeric identifier for EVM chains. Examples:
- `1` - Ethereum Mainnet
- `8453` - Base Mainnet
- `84532` - Base Sepolia

### Genesis Hash

The hash of the first block on a blockchain. Used as the reference in Solana CAIP-2 identifiers.

## SDK Terms

### x402Client

Core client class for creating payment payloads. Manages scheme registration, policy application, and payment signing.

### x402ResourceServer

Core server class for payment verification and settlement. Coordinates with facilitators and builds payment requirements.

### x402Facilitator

Core facilitator class for signature verification and on-chain settlement. Manages scheme implementations and lifecycle hooks.

### HTTPFacilitatorClient

Client for communicating with remote facilitator services over HTTP.

### Payment Middleware

Framework-specific middleware (Express, Hono, etc.) that intercepts requests and enforces payment requirements.

### Fetch Wrapper

A wrapper around the native `fetch` API that automatically handles 402 responses and payment signing.

### Scheme Registration

The process of adding payment scheme support to clients, servers, or facilitators using `register*Scheme` functions.

## HTTP Terms

### PAYMENT-SIGNATURE

Request header containing the base64-encoded payment payload signed by the client.

### PAYMENT-REQUIRED

Response header (on 402) containing base64-encoded payment requirements from the server.

### PAYMENT-RESPONSE

Response header (on 200) containing base64-encoded settlement confirmation from the facilitator.

## Asset Terms

### USDC

USD Coin, a stablecoin pegged to the US dollar. The primary payment asset supported by x402.

### Asset Address

The contract address (EVM) or mint address (Solana) identifying a specific token.

### Amount

The payment amount in the token's smallest unit (e.g., 6 decimals for USDC means `1000000` = 1 USDC).

## Verification Terms

### Verify

The process of validating a payment signature without executing the transfer. Ensures the signature is valid and matches requirements.

### Settle

The process of executing the payment transfer on-chain. Submits a transaction to move tokens from payer to payee.

### Payer

The wallet address authorizing the payment. Extracted from the payment signature during verification.

### Payee

The wallet address receiving the payment. Specified in the payment requirements as `payTo`.

## Extension Terms

### Extension

A protocol extension that adds functionality beyond basic payments. Example: Bazaar discovery extension.

### Bazaar

An extension for resource discovery that includes metadata about endpoint outputs, schemas, and examples.

## Hook Terms

### Lifecycle Hook

A callback function executed at specific points during payment processing. Enables custom logic for logging, validation, etc.

### Before Hook

A hook executed before an operation (verify/settle). Can abort the operation by returning `{ abort: true, reason: "..." }`.

### After Hook

A hook executed after a successful operation. Used for logging, metrics, or side effects.

### Failure Hook

A hook executed when an operation fails. Can recover by returning `{ recovered: true, result: ... }`.
