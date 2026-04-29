// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
// Source: @x402/avm USDC_CONFIG (faucetUrl only).
// Regenerate via: pnpm --filter @x402/paywall run build:paywall

/**
 * Per-network testnet faucet URLs for AVM, keyed by CAIP-2 network identifier.
 * Mirrors the `faucetUrl` field of `USDC_CONFIG` from `@x402/avm` and is
 * emitted at build time so the paywall's runtime module graph does not
 * depend on `@x402/avm`. Networks without a configured faucet URL are
 * absent — callers should fall back to the paywall's hardcoded default
 * (the Algorand testnet dispenser) or to a consumer-provided override on
 * `PaywallConfig.faucetUrl` / `PaywallConfig.faucetUrls[caip2]`.
 */
export const FAUCET_URLS: Record<string, string> = {
  "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=":
    "https://dispenser.testnet.aws.algodev.network/",
};
