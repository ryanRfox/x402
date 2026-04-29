/**
 * Configuration options for the paywall
 */
export interface PaywallConfig {
  appName?: string;
  appLogo?: string;
  currentUrl?: string;
  testnet?: boolean;
  /**
   * Global override for the testnet "Need {tokenName} on {chainName}? Get
   * some here" link. Applies to every chain rendered by the paywall.
   *
   * Resolution precedence (top wins):
   *   1. {@link faucetUrls}[caip2] — per-chain override
   *   2. {@link faucetUrl} — global override (this field)
   *   3. The mechanism's curated chain registry (e.g. `DEFAULT_STABLECOINS`
   *      for EVM) when the selected chain has a `faucetUrl` populated
   *   4. The mechanism's hardcoded fallback (`https://faucet.circle.com/`
   *      for EVM/SVM, the Algorand dispenser for AVM)
   *
   * Use this for whitelabel deployments that want every chain to point at
   * a single mint flow / dex / bridge regardless of the selected chain.
   */
  faucetUrl?: string;
  /**
   * Per-chain override for the testnet faucet link, keyed by CAIP-2 network
   * identifier (e.g. `"eip155:84532"`, `"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"`).
   *
   * Wins over {@link faucetUrl} for the selected chain. Use this when
   * different chains in the same paywall need distinct faucets (e.g. one
   * chain points at a Circle faucet, another at a project-specific mint).
   */
  faucetUrls?: Record<string, string>;
}

/**
 * Payment requirements structure (supports both v1 and v2)
 */
export interface PaymentRequirements {
  scheme: string;
  network: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
  // V1 fields
  maxAmountRequired?: string;
  description?: string;
  resource?: string;
  mimeType?: string;
  // V2 fields
  amount?: string;
}

/**
 * Payment required response structure
 */
export interface PaymentRequired {
  x402Version: number;
  error?: string;
  resource?: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
}

/**
 * Paywall provider interface for generating HTML
 */
export interface PaywallProvider {
  /**
   * Generate HTML for a payment required response
   *
   * @param paymentRequired - Payment required response with accepts array
   * @param config - Optional runtime configuration
   * @returns HTML string for the paywall page
   */
  generateHtml(paymentRequired: PaymentRequired, config?: PaywallConfig): string;
}

/**
 * Network-specific paywall handler
 */
export interface PaywallNetworkHandler {
  /**
   * Check if this handler supports the given payment requirement
   *
   * @param requirement - Payment requirement to check
   * @returns True if this handler can process this requirement
   */
  supports(requirement: PaymentRequirements): boolean;

  /**
   * Generate HTML for this network's paywall
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
  ): string;
}
