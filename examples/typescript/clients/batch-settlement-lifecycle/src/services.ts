import type { Server as HttpServer } from "http";
import express from "express";

import { x402Facilitator } from "@x402/core/facilitator";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { type AuthorizerSigner, toFacilitatorEvmSigner } from "@x402/evm";
import { BatchSettlementEvmScheme as FacilitatorBatchScheme } from "@x402/evm/batch-settlement/facilitator";
import {
  BatchSettlementEvmScheme as ServerBatchScheme,
  BatchSettlementChannelManager,
  InMemoryChannelStorage,
} from "@x402/evm/batch-settlement/server";
import { paymentMiddleware, setSettlementOverrides, x402ResourceServer } from "@x402/express";
import {
  type Address,
  type Chain,
  type WalletClient,
  createWalletClient,
  http,
  publicActions,
} from "viem";
import type { LocalAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const NETWORK = "eip155:84532" as const;

/** Result handle returned by {@link startFacilitator}. */
export interface FacilitatorHandle {
  /** Bound HTTP server (used to close on shutdown). */
  httpServer: HttpServer;
  /** Public URL for /verify, /settle, /supported. */
  url: string;
  /** Stops the listener and resolves when fully closed. */
  shutdown: () => Promise<void>;
}

/** Result handle returned by {@link startResourceServer}. */
export interface ResourceServerHandle {
  /** Bound HTTP server. */
  httpServer: HttpServer;
  /** Public URL for protected routes. */
  url: string;
  /** Path of the protected route (default `/weather`). */
  endpointPath: string;
  /** Server-side batch-settlement scheme — use to inspect the in-memory channel storage. */
  scheme: ServerBatchScheme;
  /** Channel manager used to manually trigger claim / settle / refund jobs. */
  channelManager: BatchSettlementChannelManager;
  /** Stops the listener and (gracefully) the channel manager auto jobs. */
  shutdown: (opts?: { flush?: boolean }) => Promise<void>;
}

/**
 * Boots a local x402 facilitator that delegates batch-settlement to the
 * relayer + receiver-authorizer derived from the supplied keys.
 *
 * @param config - Facilitator wiring options.
 * @param config.relayerAccount - Account that submits onchain transactions and pays gas.
 * @param config.receiverAuthorizerSigner - Authorizer signer that signs ClaimBatch and Refund EIP-712 messages.
 * @param config.port - TCP port for the express listener.
 * @param config.rpcUrl - Optional RPC URL override (default Base Sepolia public).
 * @returns Handle exposing the URL and a graceful shutdown helper.
 */
export async function startFacilitator(config: {
  relayerAccount: LocalAccount;
  receiverAuthorizerSigner: AuthorizerSigner;
  port: number;
  rpcUrl?: string;
}): Promise<FacilitatorHandle> {
  const { relayerAccount, receiverAuthorizerSigner, port, rpcUrl } = config;

  const viemClient = createWalletClient({
    account: relayerAccount,
    chain: baseSepolia,
    transport: http(rpcUrl),
  }).extend(publicActions);

  const evmSigner = toFacilitatorEvmSigner({
    address: relayerAccount.address as Address,
    getCode: args => viemClient.getCode(args),
    readContract: args =>
      viemClient.readContract({ ...args, args: args.args ?? [] } as Parameters<
        typeof viemClient.readContract
      >[0]),
    verifyTypedData: args =>
      viemClient.verifyTypedData(args as Parameters<typeof viemClient.verifyTypedData>[0]),
    writeContract: args =>
      viemClient.writeContract(args as Parameters<typeof viemClient.writeContract>[0]),
    sendTransaction: args =>
      viemClient.sendTransaction(args as Parameters<typeof viemClient.sendTransaction>[0]),
    waitForTransactionReceipt: args => viemClient.waitForTransactionReceipt(args),
  });

  const facilitator = new x402Facilitator().register(
    NETWORK,
    new FacilitatorBatchScheme(evmSigner, receiverAuthorizerSigner),
  );

  const app = express();
  app.use(express.json());

  app.post("/verify", async (req, res) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body as {
        paymentPayload: PaymentPayload;
        paymentRequirements: PaymentRequirements;
      };
      const response: VerifyResponse = await facilitator.verify(
        paymentPayload,
        paymentRequirements,
      );
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/settle", async (req, res) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body as {
        paymentPayload: PaymentPayload;
        paymentRequirements: PaymentRequirements;
      };
      const response: SettleResponse = await facilitator.settle(
        paymentPayload,
        paymentRequirements,
      );
      res.json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Settlement aborted:")) {
        return res.json({
          success: false,
          errorReason: error.message.replace("Settlement aborted: ", ""),
          network: req.body?.paymentPayload?.network ?? "unknown",
        } as SettleResponse);
      }
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/supported", (_req, res) => {
    res.json(facilitator.getSupported());
  });

  const httpServer = await new Promise<HttpServer>((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.on("error", reject);
  });

  return {
    httpServer,
    url: `http://localhost:${port}`,
    shutdown: () =>
      new Promise<void>((resolve, reject) =>
        httpServer.close(err => (err ? reject(err) : resolve())),
      ),
  };
}

/**
 * Boots an x402 resource server that exposes a single random-priced /weather
 * route protected by the batch-settlement scheme.
 *
 * Uses an in-memory channel storage so the demo can inspect server-side state
 * directly without parsing files.
 *
 * @param config - Resource server wiring options.
 * @param config.facilitatorUrl - Local facilitator URL.
 * @param config.receiverAddress - payTo address. Funds claim into the contract under this address.
 * @param config.receiverAuthorizerSigner - Server-side authorizer signer (recommended over facilitator delegation).
 * @param config.withdrawDelay - Channel `withdrawDelay` parameter (in seconds). Must be ≥ 900 and ≤ 2_592_000.
 * @param config.port - TCP port for the express listener.
 * @param config.maxPrice - Max charge per request — use a dollar string like "$0.01".
 * @returns Handle exposing the URL, the underlying scheme/channel manager, and a graceful shutdown helper.
 */
export async function startResourceServer(config: {
  facilitatorUrl: string;
  receiverAddress: Address;
  receiverAuthorizerSigner: AuthorizerSigner;
  withdrawDelay: number;
  port: number;
  maxPrice: string;
}): Promise<ResourceServerHandle> {
  const {
    facilitatorUrl,
    receiverAddress,
    receiverAuthorizerSigner,
    withdrawDelay,
    port,
    maxPrice,
  } = config;

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const scheme = new ServerBatchScheme(receiverAddress, {
    receiverAuthorizerSigner,
    withdrawDelay,
    storage: new InMemoryChannelStorage(),
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(NETWORK, scheme);
  const channelManager = scheme.createChannelManager(facilitatorClient, NETWORK);

  // Long auto-intervals: the demo manually drives claim/settle/refund.
  channelManager.start({
    claimIntervalSecs: 24 * 60 * 60,
    settleIntervalSecs: 24 * 60 * 60,
    refundIntervalSecs: 24 * 60 * 60,
    maxClaimsPerBatch: 100,
    onClaim: r => console.log(`[server] auto-claim: ${r.vouchers} vouchers (tx: ${r.transaction})`),
    onSettle: r => console.log(`[server] auto-settle (tx: ${r.transaction})`),
    onRefund: r => console.log(`[server] auto-refund channel ${r.channel} (tx: ${r.transaction})`),
    onError: e => console.error("[server] auto-job error:", e),
  });

  const app = express();
  const endpointPath = "/weather";

  app.use(
    paymentMiddleware(
      {
        [`GET ${endpointPath}`]: {
          accepts: {
            scheme: "batch-settlement",
            price: maxPrice,
            network: NETWORK,
            payTo: receiverAddress,
          },
          description: "Weather data",
          mimeType: "application/json",
        },
      },
      resourceServer,
    ),
  );

  app.get(endpointPath, (_req, res) => {
    // Charge a random fraction of the max — exercises usage-based billing
    // and forces non-trivial cumulative growth across requests.
    const chargedPercent = 1 + Math.floor(Math.random() * 100);
    setSettlementOverrides(res, { amount: `${chargedPercent}%` });
    res.send({
      report: { weather: "sunny", temperature: 70, chargedPercent },
    });
  });

  const httpServer = await new Promise<HttpServer>((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.on("error", reject);
  });

  return {
    httpServer,
    url: `http://localhost:${port}`,
    endpointPath,
    scheme,
    channelManager,
    shutdown: async (opts?: { flush?: boolean }) => {
      await channelManager.stop({ flush: opts?.flush ?? false });
      await new Promise<void>((resolve, reject) =>
        httpServer.close(err => (err ? reject(err) : resolve())),
      );
    },
  };
}

/**
 * Builds a viem wallet client bound to the supplied account on Base Sepolia.
 *
 * @param account - Account whose key signs transactions.
 * @param rpcUrl - Optional RPC URL override.
 * @returns A wallet client with public actions extended.
 */
export function createBaseSepoliaWallet(
  account: LocalAccount,
  rpcUrl?: string,
): WalletClient<ReturnType<typeof http>, Chain, LocalAccount> & ReturnType<typeof publicActions> {
  const client = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  return client.extend(publicActions) as WalletClient<
    ReturnType<typeof http>,
    Chain,
    LocalAccount
  > &
    ReturnType<typeof publicActions>;
}

/**
 * Wraps a private-key-only EOA into the {@link AuthorizerSigner} contract for the SDK.
 *
 * @param account - LocalAccount that produces typed-data signatures.
 * @returns Signer adapter consumed by the facilitator and resource-server schemes.
 */
export function asAuthorizerSigner(account: LocalAccount): AuthorizerSigner {
  return {
    address: account.address as Address,
    signTypedData: params =>
      account.signTypedData(params as Parameters<typeof account.signTypedData>[0]),
  };
}
