# Glossary

Key terms and concepts in the x402 protocol.

## Terms

**402 Payment Required**
: HTTP status code indicating payment is required to access the resource

**Facilitator**
: Service that verifies and settles payments on the blockchain

**Payment Payload**
: Cryptographic authorization created by the client to prove payment intent

**Payment Requirements**
: Server's specification of what payment is needed (amount, recipient, network)

**Scheme**
: Payment method (e.g., "exact" for EIP-3009 transfers)

**Network**
: Blockchain network identifier (e.g., "eip155:8453" for Base)

**Settlement**
: Execution of the payment transaction on the blockchain

**EIP-712**
: Ethereum standard for typed structured data hashing and signing

**EIP-3009**
: Ethereum standard for `transferWithAuthorization` (gasless transfers)

**x402 Version**
: Protocol version (this documentation covers v2)

## Acronyms

**EVM**
: Ethereum Virtual Machine (execution environment for smart contracts)

**SVM**
: Solana Virtual Machine

**USDC**
: USD Coin (stablecoin used for payments)

**ABI**
: Application Binary Interface (smart contract interface definition)

**RPC**
: Remote Procedure Call (blockchain node communication)

## File References

**test.config.json**
: Configuration file defining client/server capabilities

**run.sh**
: Execution script for test harness

**CLAUDE.md**
: Development guide for contributors

---

*For more details, see [What is x402?](../01-overview/what-is-x402.md)*
