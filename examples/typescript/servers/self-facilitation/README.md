# @x402/self-facilitation Example Server

Express.js server demonstrating the same paywalled route shape as the `express` example, but using an in-process facilitator created with the SDK (`x402Facilitator`) instead of calling an external facilitator URL.

## What is different from `servers/express`

- `servers/express` uses `HTTPFacilitatorClient` and `FACILITATOR_URL`
- `servers/self-facilitation` creates an SDK facilitator in the same process and passes it as a `FacilitatorClient`
- The route/payment middleware setup stays essentially the same

## Prerequisites

- Node.js v20+ (install via [nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 (install via [pnpm.io/installation](https://pnpm.io/installation))
- EVM private key with Base Sepolia ETH for settlement gas

## Setup

1. Copy `.env-local` to `.env`:

```bash
cp .env-local .env
```

Then fill required environment variables:

- `EVM_PRIVATE_KEY` - Ethereum private key used by the embedded facilitator

Optional environment variables:

- `EVM_NETWORK` *(recommended for testnet exploration)* - CAIP-2 EVM network the embedded
  facilitator operates on. Default is `eip155:84532` (Base Sepolia). Chains shipped
  in viem's chain database (and present in
  [`DEFAULT_STABLECOINS`](../../../../typescript/packages/mechanisms/evm/src/shared/defaultAssets.ts))
  just work — e.g. `eip155:8453` for Base Mainnet. For chains viem doesn't ship a
  default RPC for (or to use a custom RPC), set `EVM_RPC_URL`.
- `EVM_RPC_URL` - Custom RPC URL override. Required for chains where viem ships no
  default RPC (e.g. Mezo Testnet `eip155:31611`).

2. Install and build all packages from the TypeScript examples root:

```bash
cd ../../
pnpm install && pnpm build
cd servers/self-facilitation
```

3. Run the server:

```bash
pnpm dev
```

## Testing the server

You can test with the existing client examples:

```bash
cd ../clients/fetch
pnpm dev
```

or

```bash
cd ../clients/axios
pnpm dev
```

Both clients follow the usual two-step x402 flow:
1. First request gets `402 Payment Required`
2. Client signs and retries with `PAYMENT` headers
3. Server verifies/settles via the embedded facilitator and returns `200`
