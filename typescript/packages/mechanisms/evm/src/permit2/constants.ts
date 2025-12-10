/**
 * Permit2 constants for EIP-712 signing and contract interaction
 */

/**
 * Universal Permit2 contract address - same on all EVM chains
 * Deployed via CREATE2, ensuring identical address across networks
 */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

/**
 * Default x402 Settlement Contract addresses by network
 *
 * These contracts enforce trust-minimized Permit2 transfers by cryptographically
 * binding the recipient address in the signature.
 *
 * TODO: Update these with actual deployed addresses
 */
const DEFAULT_SETTLEMENT_ADDRESSES: Record<string, `0x${string}`> = {
  // Mainnet chains (TBD - to be deployed)
  "eip155:1": "0x0000000000000000000000000000000000000000", // Ethereum Mainnet
  "eip155:8453": "0x0000000000000000000000000000000000000000", // Base Mainnet
  "eip155:42161": "0x0000000000000000000000000000000000000000", // Arbitrum One
  "eip155:10": "0x0000000000000000000000000000000000000000", // Optimism
  "eip155:137": "0x0000000000000000000000000000000000000000", // Polygon

  // Testnet chains
  "eip155:11155111": "0x0000000000000000000000000000000000000000", // Ethereum Sepolia (TBD)
  "eip155:84532": "0xbC15B94Cb88Ef8462Daa9eb3652478887a9eA976", // Base Sepolia (deployed via CREATE2)
};

/**
 * Get settlement contract addresses with environment variable override support
 *
 * Environment variables:
 * - X402_SETTLEMENT_ADDRESS: Override for all networks (useful for local testing)
 * - X402_SETTLEMENT_ADDRESS_<CHAIN_ID>: Override for specific network (e.g., X402_SETTLEMENT_ADDRESS_84532)
 *
 * @example
 * // For local Anvil testing:
 * X402_SETTLEMENT_ADDRESS=0x... npx tsx test.ts
 *
 * // For specific network override:
 * X402_SETTLEMENT_ADDRESS_84532=0x... npx tsx test.ts
 */
function getSettlementAddresses(): Record<string, `0x${string}`> {
  const globalOverride = process.env.X402_SETTLEMENT_ADDRESS as `0x${string}` | undefined;
  const result: Record<string, `0x${string}`> = {};

  // First, process default addresses with environment variable overrides
  Object.entries(DEFAULT_SETTLEMENT_ADDRESSES).forEach(([network, defaultAddr]) => {
    // Extract chain ID from network string (e.g., "eip155:84532" -> "84532")
    const chainId = network.split(":")[1];
    const networkOverride = process.env[`X402_SETTLEMENT_ADDRESS_${chainId}`] as `0x${string}` | undefined;

    // Priority: network-specific override > global override > default
    const address = networkOverride || globalOverride || defaultAddr;
    result[network] = address;
  });

  // Then, scan for any additional X402_SETTLEMENT_ADDRESS_<CHAIN_ID> environment variables
  // This allows configuring settlement contracts for networks not in DEFAULT_SETTLEMENT_ADDRESSES
  const envKeys = Object.keys(process.env).filter(key => key.startsWith('X402_SETTLEMENT_ADDRESS_'));
  if (envKeys.length > 0) {
    console.error(`[SDK] Found ${envKeys.length} custom settlement address env vars: ${envKeys.join(', ')}`);
  }

  Object.entries(process.env).forEach(([key, value]) => {
    if (key.startsWith('X402_SETTLEMENT_ADDRESS_') && key !== 'X402_SETTLEMENT_ADDRESS') {
      const chainId = key.replace('X402_SETTLEMENT_ADDRESS_', '');
      const network = `eip155:${chainId}`;

      // Only add if not already processed above
      if (!result[network] && value && value !== '0x0000000000000000000000000000000000000000') {
        console.error(`[SDK] Adding custom settlement contract for ${network}: ${value.substring(0, 10)}...`);
        result[network] = value as `0x${string}`;
      }
    }
  });

  return result;
}

// Lazy-loaded cache for settlement addresses (loaded on first access)
let cachedSettlementAddresses: Record<string, `0x${string}`> | null = null;

/**
 * x402 Settlement Contract addresses by network
 *
 * Can be overridden via environment variables for local testing:
 * - X402_SETTLEMENT_ADDRESS: Override for all networks
 * - X402_SETTLEMENT_ADDRESS_<CHAIN_ID>: Override for specific network
 *
 * NOTE: This getter is lazy-loaded to ensure environment variables are available
 * at the time of first access, not at module import time.
 */
export function getX402SettlementAddresses(): Record<string, `0x${string}`> {
  if (!cachedSettlementAddresses) {
    cachedSettlementAddresses = getSettlementAddresses();
  }
  return cachedSettlementAddresses;
}

// IMPORTANT: Use getX402SettlementAddresses() instead of X402_SETTLEMENT_ADDRESSES
// The constant was removed because ES module imports are hoisted, causing the
// evaluation to happen before environment variables are set (e.g., via dotenv).
// Using the function ensures lazy evaluation at runtime.

/**
 * EIP-712 types for Permit2 SignatureTransfer with PaymentOrder witness
 *
 * This is the trust-minimized approach for x402 payments.
 * The witness includes the recipient address, preventing facilitator from redirecting funds.
 */
export const permit2WitnessTypes = {
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  PaymentOrder: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "recipient", type: "address" },
    { name: "paymentId", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "PaymentOrder" },
  ],
} as const;

/**
 * TypeString for Permit2 witness (used in permitWitnessTransferFrom calls)
 *
 * This must match the EIP-712 encoding of the witness type, as specified in Permit2 docs.
 */
export const PERMIT2_ORDER_TYPE =
  "PaymentOrder witness)PaymentOrder(address token,uint256 amount,address recipient,bytes32 paymentId,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)" as const;

/**
 * Permit2 SignatureTransfer ABI (subset needed for x402)
 */
export const permit2ABI = [
  {
    name: "permitTransferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "permit",
        type: "tuple",
        components: [
          {
            name: "permitted",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        name: "transferDetails",
        type: "tuple",
        components: [
          { name: "to", type: "address" },
          { name: "requestedAmount", type: "uint256" },
        ],
      },
      { name: "owner", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "permitWitnessTransferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "permit",
        type: "tuple",
        components: [
          {
            name: "permitted",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        name: "transferDetails",
        type: "tuple",
        components: [
          { name: "to", type: "address" },
          { name: "requestedAmount", type: "uint256" },
        ],
      },
      { name: "owner", type: "address" },
      { name: "witness", type: "bytes32" },
      { name: "witnessTypeString", type: "string" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "nonceBitmap",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "wordPos", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Basic ERC20 ABI for balance checks
 */
export const erc20ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * x402 Settlement Contract ABI
 *
 * Settlement contracts enable trust-minimized Permit2 transfers by:
 * 1. Receiving tokens from payer via Permit2 (with witness containing recipient)
 * 2. Transferring tokens to the recipient specified in the validated PaymentOrder
 *
 * This prevents the facilitator from redirecting funds.
 */
export const x402SettlementABI = [
  {
    name: "executePayment",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "paymentId", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "payer", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "hashOrder",
    type: "function",
    stateMutability: "pure",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "paymentId", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "PaymentExecuted",
    type: "event",
    inputs: [
      { name: "paymentId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "facilitator", type: "address", indexed: false },
    ],
  },
] as const;
