/**
 * @fileoverview Network configurations for Permit2 demo.
 *
 * Supports local Anvil and public testnets. Configuration is loaded from
 * environment variables for testnets, with hardcoded defaults for Anvil.
 */

import { defineChain, type Chain } from "viem";
import { config } from "dotenv";

// Load environment variables
config();

/** Universal Permit2 address - same CREATE2 address on all EVM chains. */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

/** Network configuration with accounts and token address. */
export interface NetworkConfig {
  /** Viem chain definition. */
  chain: Chain;
  /** RPC URL for the network. */
  rpcUrl: string;
  /** CAIP-2 network identifier. */
  networkId: string;
  /** Payer account (signs Permit2 messages). */
  payer: {
    address: `0x${string}`;
    privateKey: `0x${string}`;
  };
  /** Facilitator account (executes transfers). */
  facilitator: {
    address: `0x${string}`;
    privateKey: `0x${string}`;
  };
  /** Recipient address for test transfers. */
  recipient: `0x${string}`;
  /** Test token address (deploy if not set). */
  tokenAddress: `0x${string}` | null;
  /** Token symbol for display. */
  tokenSymbol: string;
  /** Token decimals. */
  tokenDecimals: number;
}

/** Available network names. */
export type NetworkName = "anvil" | "radius-staging" | "radius-testnet" | "base-sepolia";

/**
 * Local Anvil configuration.
 * Uses hardcoded test accounts - safe for local testing only.
 */
export const anvilConfig: NetworkConfig = {
  chain: defineChain({
    id: 31337,
    name: "Anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["http://127.0.0.1:8545"] },
    },
  }),
  rpcUrl: "http://127.0.0.1:8545",
  networkId: "eip155:31337",
  payer: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
  facilitator: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
  recipient: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  tokenAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  tokenSymbol: "USDEMO",
  tokenDecimals: 6,
};

/**
 * Radius Staging network configuration.
 * Requires PRIVATE_KEY in .env file.
 */
export const radiusStagingConfig: NetworkConfig = {
  chain: defineChain({
    id: 1223954,
    name: "Radius Staging",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://rpc.stg.tryradi.us"] },
    },
  }),
  rpcUrl: process.env.RADIUS_STAGING_RPC_URL || "https://rpc.stg.tryradi.us",
  networkId: "eip155:1223954",
  payer: {
    address: "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
    privateKey: (process.env.PRIVATE_KEY || "0x") as `0x${string}`,
  },
  facilitator: {
    // For testnets, use the same key for both payer and facilitator
    // In production, these would be separate accounts
    address: "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
    privateKey: (process.env.PRIVATE_KEY || "0x") as `0x${string}`,
  },
  // Use a different address as recipient (second Anvil address for testing)
  recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  tokenAddress: "0x20B3A535DA00f6A7285AF25280a618b38B588b66",
  tokenSymbol: "USDEMO",
  tokenDecimals: 6,
};

/**
 * Radius Testnet configuration (for later).
 */
export const radiusTestnetConfig: NetworkConfig = {
  chain: defineChain({
    id: 1223953,
    name: "Radius Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://rpc.testnet.tryradi.us"] },
    },
  }),
  rpcUrl: process.env.RADIUS_TESTNET_RPC_URL || "https://rpc.testnet.tryradi.us",
  networkId: "eip155:1223953",
  payer: {
    address: "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
    privateKey: (process.env.PRIVATE_KEY || "0x") as `0x${string}`,
  },
  facilitator: {
    address: "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
    privateKey: (process.env.PRIVATE_KEY || "0x") as `0x${string}`,
  },
  recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  tokenAddress: null,
  tokenSymbol: "USDEMO",
  tokenDecimals: 6,
};

/**
 * Base Sepolia configuration (for later).
 */
export const baseSepoliaConfig: NetworkConfig = {
  chain: defineChain({
    id: 84532,
    name: "Base Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://sepolia.base.org"] },
    },
  }),
  rpcUrl: "https://sepolia.base.org",
  networkId: "eip155:84532",
  payer: {
    address: "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
    privateKey: (process.env.PRIVATE_KEY || "0x") as `0x${string}`,
  },
  facilitator: {
    address: "0x159A4296B5db749B4aF31A2A6BEaf37EFA2A0204",
    privateKey: (process.env.PRIVATE_KEY || "0x") as `0x${string}`,
  },
  recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  tokenAddress: null,
  tokenSymbol: "USDEMO",
  tokenDecimals: 6,
};

/** All available network configurations. */
export const networks: Record<NetworkName, NetworkConfig> = {
  anvil: anvilConfig,
  "radius-staging": radiusStagingConfig,
  "radius-testnet": radiusTestnetConfig,
  "base-sepolia": baseSepoliaConfig,
};

/**
 * Gets network configuration by name.
 *
 * @param name - Network name
 * @returns Network configuration
 * @throws Error if network not found or private key missing for testnets
 */
export function getNetworkConfig(name: NetworkName): NetworkConfig {
  const config = networks[name];
  if (!config) {
    throw new Error(`Unknown network: ${name}. Available: ${Object.keys(networks).join(", ")}`);
  }

  // Validate private key for non-Anvil networks
  if (name !== "anvil" && !process.env.PRIVATE_KEY) {
    throw new Error(`PRIVATE_KEY environment variable required for ${name}`);
  }

  return config;
}

/**
 * Gets the EIP-712 domain for Permit2 on a given chain.
 *
 * @param chainId - The chain ID
 * @returns EIP-712 domain object
 */
export function getPermit2Domain(chainId: number) {
  return {
    name: "Permit2",
    chainId,
    verifyingContract: PERMIT2_ADDRESS,
  } as const;
}

/** EIP-712 Types for SignatureTransfer. */
export const PERMIT2_TYPES = {
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** Permit2 SignatureTransfer ABI (subset needed for x402). */
export const PERMIT2_ABI = [
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

/** Basic ERC20 ABI for balance, allowance, and approval. */
export const ERC20_ABI = [
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
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
