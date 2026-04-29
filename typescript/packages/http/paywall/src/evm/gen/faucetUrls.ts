// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
// Source: @x402/evm DEFAULT_STABLECOINS (faucetUrl only).
// Regenerate via: pnpm --filter @x402/paywall run build:paywall

/**
 * Per-network testnet faucet URLs, keyed by CAIP-2 network identifier.
 * Mirrors the `faucetUrl` field of `DEFAULT_STABLECOINS` from `@x402/evm`
 * and is emitted at build time so the paywall's runtime module graph does
 * not depend on `@x402/evm`. Networks without a configured faucet URL are
 * absent — callers should fall back to the paywall's hardcoded default
 * (`https://faucet.circle.com/`) or to a consumer-provided override on
 * `PaywallConfig.faucetUrl` / `PaywallConfig.faucetUrls[caip2]`.
 */
export const FAUCET_URLS: Record<string, string> = {
  "eip155:2201": "https://faucet.stable.xyz/faucet",
  "eip155:31611": "https://faucet.test.mezo.org/",
  "eip155:421614": "https://faucet.circle.com/",
  "eip155:84532": "https://faucet.circle.com/",
};
