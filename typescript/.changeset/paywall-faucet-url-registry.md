---
"@x402/paywall": minor
"@x402/evm": minor
"@x402/avm": minor
---

Add SDK-configurable faucet URL plus chain-aware registry across EVM/SVM/AVM paywalls.

- New `PaywallConfig.faucetUrl?: string` global override for the testnet "Get some here" link.
- New `PaywallConfig.faucetUrls?: Record<caip2, string>` per-chain override map.
- New optional `faucetUrl` field on EVM `DefaultAssetInfo` (`@x402/evm` `DEFAULT_STABLECOINS`) and AVM `AvmAssetConfig` (`@x402/avm` `USDC_CONFIG`); seeded for testnet entries (Base Sepolia, Arbitrum Sepolia, Mezo Testnet, Stable Testnet, Algorand Testnet, Solana Devnet, Solana Testnet).
- Build-time generated `evm/gen/faucetUrls.ts`, `svm/gen/faucetUrls.ts`, `avm/gen/faucetUrls.ts` keep the paywall bundle runtime-dep-free of `@x402/evm`/`@x402/avm`.
- Resolution precedence at render time (top wins): `PaywallConfig.faucetUrls[caip2]` → `PaywallConfig.faucetUrl` → registry default for the rendered chain → hardcoded fallback. No regression for any caller.
