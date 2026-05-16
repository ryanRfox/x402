import { x402Facilitator } from "@x402/core/facilitator";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { ExactEvmScheme as ExactEvmServerScheme } from "@x402/evm/exact/server";
import { config } from "dotenv";
import express from "express";
import { type Chain, createWalletClient, defineChain, http, publicActions } from "viem";
import * as allChains from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

config();

if (!process.env.EVM_PRIVATE_KEY) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// CAIP-2 EVM network selection. Default is Base Sepolia (eip155:84532); set
// EVM_NETWORK to point at any EVM chain. EVM_RPC_URL overrides viem's chain
// default RPC (required for chains viem doesn't ship with a public RPC).
const EVM_NETWORK = (process.env.EVM_NETWORK ?? "eip155:84532") as `${string}:${string}`;

/**
 * Map a CAIP-2 EVM identifier to a viem `Chain`. Falls back to a minimal
 * `defineChain` so chains viem hasn't packaged still work for callers
 * supplying their own EVM_RPC_URL.
 *
 * @param caip2 - CAIP-2 EVM identifier (e.g. "eip155:84532")
 * @returns viem Chain object suitable for createWalletClient/createPublicClient
 */
function resolveViemChain(caip2: string): Chain {
  const [namespace, ref] = caip2.split(":");
  if (namespace !== "eip155") {
    throw new Error(`resolveViemChain: not an EVM network: ${caip2}`);
  }
  const chainId = Number(ref);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`resolveViemChain: invalid EVM chain id in ${caip2}`);
  }
  const known = (Object.values(allChains) as Chain[]).find(c => c.id === chainId);
  if (known) return known;
  return defineChain({
    id: chainId,
    name: `EVM ${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [] } },
  });
}

const evmChain = resolveViemChain(EVM_NETWORK);
const evmRpcUrl = process.env.EVM_RPC_URL?.trim() || evmChain.rpcUrls.default?.http?.[0] || "";

const evmAccount = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

// 1) Build facilitator signer from an on-chain client.
const viemClient = createWalletClient({
  account: evmAccount,
  chain: evmChain,
  transport: http(evmRpcUrl || undefined),
}).extend(publicActions);

const evmSigner = toFacilitatorEvmSigner({
  address: evmAccount.address,
  getCode: viemClient.getCode,
  readContract: viemClient.readContract,
  verifyTypedData: viemClient.verifyTypedData,
  writeContract: viemClient.writeContract,
  sendTransaction: viemClient.sendTransaction,
  waitForTransactionReceipt: viemClient.waitForTransactionReceipt,
});

// 2) Build an in-process facilitator and register supported scheme/network.
const facilitator = new x402Facilitator();
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: EVM_NETWORK,
});

// 3) Use standard express middleware wired to the local facilitator.
const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: EVM_NETWORK,
            payTo: evmAccount.address,
          },
        ],
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer({
      verify: facilitator.verify.bind(facilitator),
      settle: facilitator.settle.bind(facilitator),
      getSupported: async () => facilitator.getSupported(),
    }).register(EVM_NETWORK, new ExactEvmServerScheme()),
  ),
);

app.get("/weather", (_req, res) => {
  res.send({
    report: {
      weather: "sunny",
      temperature: 70,
    },
  });
});

app.listen(4021, () => {
  console.log(`Server listening at http://localhost:${4021}`);
});
