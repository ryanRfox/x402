---
"@x402/paywall": patch
---

fix(paywall): use dynamic token decimals instead of hardcoding 6

The EVM paywall no longer assumes all tokens have 6 decimal places. Server-side
amount conversion reads decimals from a known-decimals map aligned with
DEFAULT_STABLECOINS. Client-side balance display queries the token's ERC-20
decimals() function on-chain and reads the asset address from payment requirements.
