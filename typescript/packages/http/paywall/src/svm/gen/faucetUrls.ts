// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
// Source: `SVM_FAUCET_URLS` inline map in `src/svm/build.ts`.
// Regenerate via: pnpm --filter @x402/paywall run build:paywall

/**
 * Per-network testnet faucet URLs for Solana, keyed by CAIP-2 network
 * identifier. Solana mechanism has no `DEFAULT_STABLECOINS` parallel,
 * so this map is curated inline in `src/svm/build.ts` rather than
 * sourced from `@x402/svm`. Networks without a configured faucet URL
 * are absent — callers should fall back to the paywall's hardcoded
 * default (`https://faucet.circle.com/`) or to a consumer-provided
 * override on `PaywallConfig.faucetUrl` / `PaywallConfig.faucetUrls[caip2]`.
 */
export const FAUCET_URLS: Record<string, string> = {
  "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z": "https://faucet.circle.com/",
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "https://faucet.circle.com/",
};
