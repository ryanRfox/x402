---
"@x402/evm": patch
---

spec(exact-evm): add optional `extra.decimals` field to `PaymentRequirements` across eip3009, permit2, and erc7710 sections

Informational display-metadata hint for client amount rendering. Servers SHOULD include to save clients an on-chain RPC round trip. Clients MUST fall back to querying ERC-20 `decimals()` when absent, and SHOULD cross-check server-asserted values against a trusted token registry before rendering amounts. MUST NOT affect payment verification or settlement.
