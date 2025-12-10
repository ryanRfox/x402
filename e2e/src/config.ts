/**
 * Network-aware environment variable resolution for E2E tests
 *
 * This module provides a unified configuration interface that handles
 * network-specific environment variable overrides. The system works by:
 *
 * 1. Reading EVM_NETWORK from environment (format: "eip155:${CHAIN_ID}")
 * 2. Extracting the numeric chain ID
 * 3. Looking for network-specific variables with suffix "_${CHAIN_ID}"
 * 4. Falling back to base variable names if network-specific variants don't exist
 *
 * Example:
 *   EVM_NETWORK=eip155:1223953
 *   EVM_RPC_URL=https://sepolia.base.org (default/base)
 *   EVM_RPC_URL_1223953=https://rpc.testnet.radiustech.xyz (override for network 1223953)
 *
 *   getNetworkConfigValue('EVM_RPC_URL') → https://rpc.testnet.radiustech.xyz
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Extract numeric chain ID from network string
 * @param networkStr - Network string in format "eip155:${CHAIN_ID}"
 * @returns Numeric chain ID (e.g., "84532" from "eip155:84532")
 * @throws Error if network string is invalid
 */
function extractChainId(networkStr: string): string {
  const parts = networkStr.split(':');
  if (parts.length !== 2 || !parts[1]) {
    throw new Error(
      `Invalid EVM_NETWORK format: "${networkStr}". Expected format: "eip155:${CHAIN_ID}"`
    );
  }
  return parts[1];
}

/**
 * Retrieve a configuration value with network-specific override support
 *
 * Resolution order:
 * 1. Network-specific variable: ${KEY}_${CHAIN_ID}
 * 2. Base variable: ${KEY}
 * 3. Throw error if neither exists
 *
 * @param baseKey - Base environment variable name (e.g., "EVM_RPC_URL")
 * @param optional - If true, return undefined instead of throwing error
 * @returns Environment variable value
 * @throws Error if variable not found and not optional
 */
function getNetworkConfigValue(baseKey: string, optional = false): string | undefined {
  const networkStr = process.env.EVM_NETWORK;
  if (!networkStr) {
    if (optional) return undefined;
    throw new Error('EVM_NETWORK not set in environment');
  }

  const chainId = extractChainId(networkStr);
  const suffixedKey = `${baseKey}_${chainId}`;

  // Try network-specific override first, then fall back to base
  const value = process.env[suffixedKey] || process.env[baseKey];

  if (!value) {
    if (optional) return undefined;
    throw new Error(
      `${baseKey} not configured for network ${networkStr}. ` +
      `Set either ${suffixedKey} or ${baseKey} in environment.`
    );
  }

  return value;
}

/**
 * Parse integer configuration value with network-specific override support
 */
function getNetworkConfigInt(baseKey: string, defaultValue?: number): number {
  const value = getNetworkConfigValue(baseKey, !!defaultValue);
  if (!value && defaultValue !== undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value || '', 10);
  if (isNaN(parsed)) {
    throw new Error(`${baseKey} must be a valid integer, got: ${value}`);
  }
  return parsed;
}

/**
 * Resolved E2E test configuration object
 * Lazy-loaded on first access to ensure environment is fully initialized
 */
let cachedConfig: ReturnType<typeof resolveConfig> | null = null;

function resolveConfig() {
  return {
    // Network configuration
    network: process.env.EVM_NETWORK || 'eip155:84532',
    evmRpcUrl: getNetworkConfigValue('EVM_RPC_URL'),

    // Account credentials (can differ per network)
    clientEVMPrivateKey: getNetworkConfigValue('CLIENT_EVM_PRIVATE_KEY'),
    facilitatorEVMPrivateKey: getNetworkConfigValue('FACILITATOR_EVM_PRIVATE_KEY'),
    serverEVMAddress: getNetworkConfigValue('SERVER_EVM_ADDRESS'),

    // Permit2 token configuration (can differ per network)
    permit2TokenAddress: getNetworkConfigValue('PERMIT2_TOKEN_ADDRESS'),
    permit2TokenDecimals: getNetworkConfigInt('PERMIT2_TOKEN_DECIMALS'),

    // Settlement contract address (can differ per network)
    x402SettlementAddress: getNetworkConfigValue('X402_SETTLEMENT_ADDRESS'),

    // Solana configuration (typically not network-specific)
    clientSVMPrivateKey: getNetworkConfigValue('CLIENT_SVM_PRIVATE_KEY', true),
    facilitatorSVMPrivateKey: getNetworkConfigValue('FACILITATOR_SVM_PRIVATE_KEY', true),
    serverSVMAddress: getNetworkConfigValue('SERVER_SVM_ADDRESS', true),
  };
}

/**
 * Get resolved configuration with lazy loading
 * Use this function instead of importing config directly to ensure
 * dotenv has loaded environment variables first.
 */
export function getConfig() {
  if (!cachedConfig) {
    cachedConfig = resolveConfig();
  }
  return cachedConfig;
}

/**
 * Log configuration summary for debugging (masks sensitive values)
 */
export function logConfigSummary() {
  const cfg = getConfig();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('E2E Configuration Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Network: ${cfg.network}`);
  console.log(`RPC URL: ${cfg.evmRpcUrl}`);
  console.log(`Client EVM: ${cfg.clientEVMPrivateKey.substring(0, 10)}...`);
  console.log(`Facilitator EVM: ${cfg.facilitatorEVMPrivateKey.substring(0, 10)}...`);
  console.log(`Server EVM Address: ${cfg.serverEVMAddress}`);
  console.log(`Permit2 Token: ${cfg.permit2TokenAddress}`);
  console.log(`Permit2 Decimals: ${cfg.permit2TokenDecimals}`);
  console.log(`Settlement Contract: ${cfg.x402SettlementAddress}`);
  console.log('═══════════════════════════════════════════════════════════');
}

// Export types for convenience
export type Config = ReturnType<typeof resolveConfig>;
