import type {
  PaywallNetworkHandler,
  PaymentRequirements,
  PaymentRequired,
  PaywallConfig,
} from "../types";
import { getEvmPaywallHtml } from "./paywall";

/**
 * Known token decimals by network. Mirrors DEFAULT_STABLECOINS in @x402/evm.
 * Kept here to avoid a cross-package dependency on server internals.
 */
const KNOWN_DECIMALS: Record<string, number> = {
  "eip155:4326": 18, // MegaETH MegaUSD
  "eip155:31611": 18, // Mezo Testnet Mezo USD
};

/**
 * Resolves the token decimals for a payment requirement.
 * Checks the known decimals map first, then falls back to 6 (USDC default).
 *
 * @param requirement - The payment requirement
 * @returns The number of decimals for the payment token
 */
function getTokenDecimals(requirement: PaymentRequirements): number {
  return KNOWN_DECIMALS[requirement.network] ?? 6;
}

/**
 * EVM paywall handler that supports EVM-based networks (CAIP-2 format only)
 */
export const evmPaywall: PaywallNetworkHandler = {
  /**
   * Check if this handler supports the given payment requirement
   *
   * @param requirement - Payment requirement to check
   * @returns True if this handler can process this requirement
   */
  supports(requirement: PaymentRequirements): boolean {
    return requirement.network.startsWith("eip155:");
  },

  /**
   * Generate EVM-specific paywall HTML
   *
   * @param requirement - The selected payment requirement
   * @param paymentRequired - Full payment required response
   * @param config - Paywall configuration
   * @returns HTML string for the paywall page
   */
  generateHtml(
    requirement: PaymentRequirements,
    paymentRequired: PaymentRequired,
    config: PaywallConfig,
  ): string {
    const decimals = getTokenDecimals(requirement);
    const divisor = 10 ** decimals;
    const amount = requirement.amount
      ? parseFloat(requirement.amount) / divisor
      : requirement.maxAmountRequired
        ? parseFloat(requirement.maxAmountRequired) / divisor
        : 0;

    return getEvmPaywallHtml({
      amount,
      paymentRequired,
      currentUrl: paymentRequired.resource?.url || config.currentUrl || "",
      testnet: config.testnet ?? true,
      appName: config.appName,
      appLogo: config.appLogo,
    });
  },
};
