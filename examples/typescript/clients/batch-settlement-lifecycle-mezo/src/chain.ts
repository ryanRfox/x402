import { defineChain } from "viem";

/**
 * Mezo Testnet chain definition for viem clients.
 *
 * Mezo's "Matsnet" testnet uses Bitcoin (BTC) as its native gas currency at 18
 * decimals — identical scaling to ETH. Chain id `31611` corresponds to the
 * `eip155:31611` x402 network identifier.
 */
export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Matsnet",
  nativeCurrency: {
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.test.mezo.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Mezo Testnet Explorer",
      url: "https://explorer.test.mezo.org",
    },
  },
  testnet: true,
});

/** Default Mezo Testnet RPC URL — overridable via `EVM_RPC_URL` env var. */
export const DEFAULT_MEZO_RPC_URL = "https://rpc.test.mezo.org";
