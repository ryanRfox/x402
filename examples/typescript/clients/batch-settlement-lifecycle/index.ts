import { config as loadEnv } from "dotenv";
import {
  type Address,
  type Hex,
  createPublicClient,
  getAddress,
  http,
  keccak256,
  parseUnits,
  toBytes,
} from "viem";
import { type LocalAccount, privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { toClientEvmSigner } from "@x402/evm";
import {
  type BatchSettlementClientContext,
  BatchSettlementEvmScheme as ClientScheme,
  type ClientChannelStorage,
  computeChannelId,
} from "@x402/evm/batch-settlement/client";
import { x402Client, x402HTTPClient, wrapFetchWithPayment } from "@x402/fetch";

import {
  type ChannelConfigTuple,
  USDC_BASE_SEPOLIA,
  finalizeWithdraw,
  initiateWithdraw,
  readErc20Balance,
  readOnchainChannelState,
  readReceiverTotals,
} from "./src/contract";
import {
  type PhaseResult,
  assertInvariant,
  fmtUsdc,
  phaseHeader,
  printDiff,
  printSummary,
  sleep,
} from "./src/printing";
import {
  type ResourceServerHandle,
  asAuthorizerSigner,
  createBaseSepoliaWallet,
  startFacilitator,
  startResourceServer,
} from "./src/services";

loadEnv();

const NETWORK = "eip155:84532" as const;
const FACILITATOR_PORT = 4022;
const SERVER_PORT = 4021;
const MAX_PRICE = "$0.01"; // server-side per-request cap; actual charge is randomized via setSettlementOverrides
const WITHDRAW_DELAY_SECS = 900; // 15 minutes — the contract minimum
const ENDPOINT_PATH = "/weather";

/** Inspectable wrapper around the SDK's in-memory client storage. */
class InspectableClientStorage implements ClientChannelStorage {
  private readonly inner = new Map<string, BatchSettlementClientContext>();

  /**
   * Returns the channel record for `key` if present.
   *
   * @param key - Channel storage key (channelId).
   * @returns Persisted context or undefined.
   */
  async get(key: string): Promise<BatchSettlementClientContext | undefined> {
    return this.inner.get(key);
  }

  /**
   * Stores or replaces the channel record for `key`.
   *
   * @param key - Channel storage key.
   * @param context - Channel fields to persist.
   */
  async set(key: string, context: BatchSettlementClientContext): Promise<void> {
    this.inner.set(key, context);
  }

  /**
   * Removes the channel record for `key` if it exists.
   *
   * @param key - Channel storage key.
   */
  async delete(key: string): Promise<void> {
    this.inner.delete(key);
  }

  /**
   * Wipes every cached channel — used to simulate state loss in Phase 3.
   */
  clear(): void {
    this.inner.clear();
  }

  /**
   * Returns a JSON-friendly view of the local storage for diagnostic prints.
   *
   * @returns Plain object keyed by channel id.
   */
  snapshot(): Record<string, BatchSettlementClientContext> {
    return Object.fromEntries(this.inner.entries());
  }
}

/**
 * Validates and resolves the runtime configuration from environment variables.
 *
 * @returns Resolved environment with payer / receiver / authorizer accounts and addresses.
 */
function resolveEnv(): {
  payerAccount: LocalAccount;
  receiverAuthorizerAccount: LocalAccount;
  receiverAddress: Address;
  rpcUrl: string | undefined;
  waitFullWithdraw: boolean;
} {
  const payerKey = process.env.EVM_PRIVATE_KEY as `0x${string}` | undefined;
  if (!payerKey || !/^0x[0-9a-fA-F]{64}$/.test(payerKey)) {
    throw new Error("EVM_PRIVATE_KEY is required (0x-prefixed 32-byte hex)");
  }
  const payerAccount = privateKeyToAccount(payerKey);

  const authorizerKey = (process.env.EVM_RECEIVER_AUTHORIZER_PRIVATE_KEY ??
    payerKey) as `0x${string}`;
  const receiverAuthorizerAccount = privateKeyToAccount(authorizerKey);

  const explicitReceiver = process.env.EVM_RECEIVER_ADDRESS;
  let receiverAddress: Address;
  if (explicitReceiver) {
    receiverAddress = getAddress(explicitReceiver) as Address;
  } else {
    // Derive a deterministic, distinct receiver from the payer's address so a
    // refund flows back to the payer key while settle still pulls funds into
    // a separate account. Pure demo convenience — production deployments
    // should set EVM_RECEIVER_ADDRESS explicitly.
    const derivedKey = keccak256(
      toBytes(`x402-batch-settlement-demo:receiver:${payerAccount.address}`),
    );
    receiverAddress = privateKeyToAccount(derivedKey).address;
  }

  return {
    payerAccount,
    receiverAuthorizerAccount,
    receiverAddress,
    rpcUrl: process.env.EVM_RPC_URL,
    waitFullWithdraw: process.env.WAIT_FULL_WITHDRAW === "true",
  };
}

/**
 * Builds an x402 client bound to a single batch-settlement scheme instance and a fresh storage.
 *
 * @param payerAccount - The payer EOA.
 * @param storage - Mutable storage so the orchestrator can wipe it on demand.
 * @param salt - Channel salt that distinguishes phase-1 vs phase-5 channels.
 * @param rpcUrl - Optional RPC override for onchain reads.
 * @returns The bound client + scheme + viem fetch wrapper.
 */
function buildPaymentClient(
  payerAccount: LocalAccount,
  storage: ClientChannelStorage,
  salt: Hex,
  rpcUrl: string | undefined,
): {
  scheme: ClientScheme;
  fetchWithPayment: typeof fetch;
  httpClient: x402HTTPClient;
} {
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  const signer = toClientEvmSigner(payerAccount, publicClient);

  const scheme = new ClientScheme(signer, {
    storage,
    depositPolicy: { depositMultiplier: 5 },
    salt,
  });

  const client = new x402Client();
  client.register("eip155:*", scheme);
  return {
    scheme,
    fetchWithPayment: wrapFetchWithPayment(fetch, client),
    httpClient: new x402HTTPClient(client),
  };
}

/**
 * Sends one paid request through the supplied client and unwraps the body / settle response.
 *
 * @param fetchWithPayment - Wrapped fetch.
 * @param httpClient - HTTP client used to interpret PAYMENT-RESPONSE headers.
 * @param url - Protected endpoint URL.
 * @returns Either the body + settle response on success, or the error result kind.
 */
async function paidRequest(
  fetchWithPayment: typeof fetch,
  httpClient: x402HTTPClient,
  url: string,
): Promise<
  | { kind: "success"; body: unknown; settle: { transaction?: string; payer?: string } }
  | { kind: "error"; result: unknown }
> {
  const response = await fetchWithPayment(url, { method: "GET" });
  const result = await httpClient.processResponse(response);
  if (result.kind === "success") {
    return {
      kind: "success",
      body: result.body,
      settle: result.settleResponse as { transaction?: string; payer?: string },
    };
  }
  return { kind: "error", result };
}

/**
 * Reads the server-side channel snapshot from in-memory storage.
 *
 * @param server - Resource server handle exposing the scheme.
 * @param channelId - Channel id, lower-cased.
 * @returns Server's chargedCumulativeAmount + signed voucher state, or null if not stored.
 */
async function readServerChannel(
  server: ResourceServerHandle,
  channelId: Hex,
): Promise<{
  chargedCumulativeAmount: string;
  signedMaxClaimable: string;
  totalClaimed: string;
  balance: string;
  refundNonce: number;
  withdrawRequestedAt: number;
} | null> {
  const channel = await server.scheme.getStorage().get(channelId.toLowerCase());
  if (!channel) return null;
  return {
    chargedCumulativeAmount: channel.chargedCumulativeAmount,
    signedMaxClaimable: channel.signedMaxClaimable,
    totalClaimed: channel.totalClaimed,
    balance: channel.balance,
    refundNonce: channel.refundNonce,
    withdrawRequestedAt: channel.withdrawRequestedAt,
  };
}

/**
 * Runs the full 5-phase batch-settlement lifecycle demo.
 *
 * @returns A summary of phase outcomes; throws if a phase invariant fails.
 */
async function main(): Promise<PhaseResult[]> {
  const env = resolveEnv();
  const facilitatorAuthorizerSigner = asAuthorizerSigner(env.receiverAuthorizerAccount);

  console.log("Configuration:");
  console.log(`  network              ${NETWORK} (Base Sepolia)`);
  console.log(`  payer                ${env.payerAccount.address}`);
  console.log(`  receiver (payTo)     ${env.receiverAddress}`);
  console.log(`  receiverAuthorizer   ${env.receiverAuthorizerAccount.address}`);
  console.log(`  facilitator relayer  ${env.payerAccount.address} (same key — demo only)`);
  console.log(`  withdrawDelay        ${WITHDRAW_DELAY_SECS}s (contract minimum: 900)`);
  console.log(`  facilitator url      http://localhost:${FACILITATOR_PORT}`);
  console.log(`  resource server url  http://localhost:${SERVER_PORT}${ENDPOINT_PATH}\n`);

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(env.rpcUrl) });
  const usdcBefore = await readErc20Balance(
    publicClient,
    USDC_BASE_SEPOLIA,
    env.payerAccount.address,
  );
  console.log(`Payer USDC balance: ${fmtUsdc(usdcBefore)}\n`);
  if (usdcBefore < parseUnits("0.10", 6)) {
    console.warn(
      "WARNING: payer USDC balance is below $0.10 — Base Sepolia faucet: https://faucet.circle.com\n",
    );
  }

  // Boot facilitator + server in this process.
  const facilitator = await startFacilitator({
    relayerAccount: env.payerAccount,
    receiverAuthorizerSigner: facilitatorAuthorizerSigner,
    port: FACILITATOR_PORT,
    rpcUrl: env.rpcUrl,
  });
  let server: ResourceServerHandle | null = await startResourceServer({
    facilitatorUrl: facilitator.url,
    receiverAddress: env.receiverAddress,
    receiverAuthorizerSigner: asAuthorizerSigner(env.receiverAuthorizerAccount),
    withdrawDelay: WITHDRAW_DELAY_SECS,
    port: SERVER_PORT,
    maxPrice: MAX_PRICE,
  });

  const results: PhaseResult[] = [];

  try {
    // Phase 1: open the channel.
    const channel1Salt = keccak256(toBytes(`x402-batch-settlement-demo:phase1:${Date.now()}`));
    const storage1 = new InspectableClientStorage();
    const client1 = buildPaymentClient(env.payerAccount, storage1, channel1Salt, env.rpcUrl);
    const url1 = `${server.url}${server.endpointPath}`;
    const requirementsForChannel1 = {
      scheme: "batch-settlement",
      network: NETWORK,
      payTo: env.receiverAddress,
      amount: "1",
      asset: USDC_BASE_SEPOLIA,
      maxTimeoutSeconds: 60,
      extra: {
        receiverAuthorizer: env.receiverAuthorizerAccount.address,
        withdrawDelay: WITHDRAW_DELAY_SECS,
      },
    } as Parameters<typeof client1.scheme.buildChannelConfig>[0];

    let channel1Id: Hex;
    {
      phaseHeader(1, "Open — first paid request bundles a deposit");
      const config = client1.scheme.buildChannelConfig(requirementsForChannel1);
      channel1Id = computeChannelId(config, NETWORK);
      console.log(`  channelId            ${channel1Id}`);
      console.log(`  payerAuthorizer      ${config.payerAuthorizer}`);
      console.log(`  receiverAuthorizer   ${config.receiverAuthorizer}`);
      console.log(`  withdrawDelay        ${config.withdrawDelay}s`);
      console.log(`  salt                 ${config.salt}\n`);

      const beforeOnchain = await readOnchainChannelState(publicClient, channel1Id);
      printDiff("onchain.balance", fmtUsdc(beforeOnchain.balance), "(pending)");
      printDiff("onchain.totalClaimed", fmtUsdc(beforeOnchain.totalClaimed), "(pending)");
      console.log("\n  Sending first paid request (deposit + voucher)…");

      const result = await paidRequest(client1.fetchWithPayment, client1.httpClient, url1);
      if (result.kind !== "success") {
        throw new Error(`Phase 1 first request failed: ${JSON.stringify(result.result)}`);
      }

      const afterOnchain = await readOnchainChannelState(publicClient, channel1Id);
      const localState = await storage1.get(channel1Id.toLowerCase());
      const serverState = await readServerChannel(server, channel1Id);

      console.log("\n  After first request:");
      printDiff("onchain.balance", fmtUsdc(beforeOnchain.balance), fmtUsdc(afterOnchain.balance));
      printDiff(
        "onchain.totalClaimed",
        fmtUsdc(beforeOnchain.totalClaimed),
        fmtUsdc(afterOnchain.totalClaimed),
      );
      printDiff("local.chargedCumulative", "0", localState?.chargedCumulativeAmount ?? "—");
      printDiff("local.balance", "0", localState?.balance ?? "—");
      printDiff(
        "server.chargedCumulative",
        "(no record)",
        serverState?.chargedCumulativeAmount ?? "—",
      );
      printDiff("server.signedMaxClaimable", "(no record)", serverState?.signedMaxClaimable ?? "—");
      console.log();

      assertInvariant(
        "channel funded onchain",
        afterOnchain.balance > 0n,
        `balance=${fmtUsdc(afterOnchain.balance)}`,
      );
      assertInvariant(
        "server tracked the voucher",
        serverState !== null && BigInt(serverState.chargedCumulativeAmount) > 0n,
        `chargedCumulative=${serverState?.chargedCumulativeAmount}`,
      );
      assertInvariant(
        "voucher.maxClaimable >= chargedCumulative",
        serverState !== null &&
          BigInt(serverState.signedMaxClaimable) >= BigInt(serverState.chargedCumulativeAmount),
      );

      results.push({
        phase: 1,
        name: "Open",
        expected: "deposit funded the channel; first voucher matched the random server charge",
        actual: `balance=${fmtUsdc(afterOnchain.balance)}, chargedCumulative=${fmtUsdc(serverState?.chargedCumulativeAmount)}`,
        passed: true,
      });
    }

    // Phase 2: steady-state.
    {
      phaseHeader(2, "Steady-state — five paid requests over the existing channel");
      const STEADY_REQUESTS = 5;
      let lastServerCharged = 0n;

      for (let i = 1; i <= STEADY_REQUESTS; i++) {
        const result = await paidRequest(client1.fetchWithPayment, client1.httpClient, url1);
        if (result.kind !== "success") {
          throw new Error(`Phase 2 request ${i} failed: ${JSON.stringify(result.result)}`);
        }
        const localState = await storage1.get(channel1Id.toLowerCase());
        const serverState = await readServerChannel(server, channel1Id);
        const onchainState = await readOnchainChannelState(publicClient, channel1Id);

        const localCharged = BigInt(localState?.chargedCumulativeAmount ?? "0");
        const serverCharged = BigInt(serverState?.chargedCumulativeAmount ?? "0");

        console.log(
          `  request ${i}/${STEADY_REQUESTS}: voucher=${fmtUsdc(localState?.signedMaxClaimable ?? localCharged)} ` +
            `server.charged=${fmtUsdc(serverCharged)} onchain.totalClaimed=${fmtUsdc(onchainState.totalClaimed)}`,
        );

        assertInvariant(
          `request ${i}: client and server cumulative agree`,
          localCharged === serverCharged,
          `local=${localCharged}, server=${serverCharged}`,
        );
        assertInvariant(
          `request ${i}: cumulative monotonically increased`,
          serverCharged > lastServerCharged,
          `prev=${lastServerCharged}, now=${serverCharged}`,
        );
        assertInvariant(
          `request ${i}: chargedCumulative <= signedMaxClaimable`,
          serverState !== null &&
            BigInt(serverState.chargedCumulativeAmount) <= BigInt(serverState.signedMaxClaimable),
        );
        lastServerCharged = serverCharged;
      }

      const onchainAfter = await readOnchainChannelState(publicClient, channel1Id);
      assertInvariant(
        "onchain.totalClaimed still 0 — claims are batched, not per-request",
        onchainAfter.totalClaimed === 0n,
        `onchain.totalClaimed=${onchainAfter.totalClaimed}`,
      );
      results.push({
        phase: 2,
        name: "Steady-state",
        expected: "5 vouchers signed; cumulative grows but no onchain claim yet",
        actual: `final cumulative=${fmtUsdc(lastServerCharged)}; onchain.totalClaimed=0`,
        passed: true,
      });
    }

    // Phase 3: state-loss recovery via corrective 402.
    {
      phaseHeader(3, "State-loss recovery — wipe client storage; expect corrective 402 + retry");
      const beforeLocal = storage1.snapshot();
      console.log(`  local storage entries before wipe: ${Object.keys(beforeLocal).length}`);
      storage1.clear();
      console.log(
        `  local storage entries after wipe:  ${Object.keys(storage1.snapshot()).length}`,
      );

      const serverBefore = await readServerChannel(server, channel1Id);
      console.log(
        `  server.chargedCumulative still: ${fmtUsdc(serverBefore?.chargedCumulativeAmount)}`,
      );
      console.log("\n  Sending one paid request — client must resync from corrective 402…");

      const result = await paidRequest(client1.fetchWithPayment, client1.httpClient, url1);
      if (result.kind !== "success") {
        throw new Error(`Phase 3 recovery request failed: ${JSON.stringify(result.result)}`);
      }

      const localAfter = await storage1.get(channel1Id.toLowerCase());
      const serverAfter = await readServerChannel(server, channel1Id);
      console.log("\n  After recovery + retry:");
      printDiff("local.chargedCumulative", "(wiped)", localAfter?.chargedCumulativeAmount ?? "—");
      printDiff(
        "local.signedMaxClaimable",
        "(wiped)",
        localAfter?.signedMaxClaimable ?? localAfter?.chargedCumulativeAmount ?? "—",
      );
      printDiff(
        "server.chargedCumulative",
        serverBefore?.chargedCumulativeAmount ?? "—",
        serverAfter?.chargedCumulativeAmount ?? "—",
      );

      assertInvariant(
        "local state was rebuilt",
        localAfter !== undefined && localAfter.chargedCumulativeAmount !== undefined,
        `local=${JSON.stringify(localAfter)}`,
      );
      assertInvariant(
        "client and server cumulative agree post-recovery",
        BigInt(localAfter?.chargedCumulativeAmount ?? "0") ===
          BigInt(serverAfter?.chargedCumulativeAmount ?? "0"),
      );
      assertInvariant(
        "post-recovery cumulative > pre-wipe server cumulative (one new request landed)",
        BigInt(serverAfter?.chargedCumulativeAmount ?? "0") >
          BigInt(serverBefore?.chargedCumulativeAmount ?? "0"),
      );
      results.push({
        phase: 3,
        name: "State-loss recovery",
        expected: "wiped client recovers from corrective 402 and retries exactly once",
        actual: `cumulative ${fmtUsdc(serverBefore?.chargedCumulativeAmount)} -> ${fmtUsdc(serverAfter?.chargedCumulativeAmount)}`,
        passed: true,
      });
    }

    // Phase 4: cooperative refund.
    {
      phaseHeader(4, "Cooperative refund — server claims outstanding vouchers, signs refund");
      console.log("  Triggering channelManager.claimAndSettle() to flush vouchers onchain…");
      const claimRes = await server.channelManager.claimAndSettle({ maxClaimsPerBatch: 100 });
      console.log(
        `  claim batches: ${claimRes.claims.length} (vouchers: ${claimRes.claims.reduce((a, c) => a + c.vouchers, 0)})`,
      );
      if (claimRes.settle) console.log(`  settle tx:     ${claimRes.settle.transaction}`);

      const onchainAfterClaim = await readOnchainChannelState(publicClient, channel1Id);
      const receiverTotalsAfterClaim = await readReceiverTotals(
        publicClient,
        env.receiverAddress,
        USDC_BASE_SEPOLIA,
      );
      console.log(
        `  onchain.totalClaimed: ${fmtUsdc(onchainAfterClaim.totalClaimed)}; ` +
          `receivers.totalSettled: ${fmtUsdc(receiverTotalsAfterClaim.totalSettled)}`,
      );

      console.log("\n  Calling scheme.refund(url) — full refund of remaining channel balance…");
      const usdcBeforeRefund = await readErc20Balance(
        publicClient,
        USDC_BASE_SEPOLIA,
        env.payerAccount.address,
      );
      const refundSettle = await client1.scheme.refund(url1);
      console.log(`  refund tx: ${refundSettle.transaction ?? "(none)"}`);

      // Pin the post-refund readbacks to the receipt's block. waitForTransactionReceipt
      // alone is insufficient on load-balanced public RPCs (e.g. https://sepolia.base.org):
      // it polls until *some* node returns the receipt, but the next readContract can
      // land on a different node still 1 block behind. Block-pinning forces every node
      // to either serve that exact block or return an error.
      let refundReceiptBlock: bigint | undefined;
      if (refundSettle.transaction) {
        const refundReceipt = await publicClient.waitForTransactionReceipt({
          hash: refundSettle.transaction as `0x${string}`,
        });
        refundReceiptBlock = refundReceipt.blockNumber;
      }

      const onchainAfterRefund = await readOnchainChannelState(
        publicClient,
        channel1Id,
        refundReceiptBlock,
      );
      const usdcAfterRefund = await readErc20Balance(
        publicClient,
        USDC_BASE_SEPOLIA,
        env.payerAccount.address,
        refundReceiptBlock,
      );
      console.log("\n  After refund:");
      printDiff(
        "onchain.balance",
        fmtUsdc(onchainAfterClaim.balance),
        fmtUsdc(onchainAfterRefund.balance),
      );
      printDiff(
        "onchain.totalClaimed",
        fmtUsdc(onchainAfterClaim.totalClaimed),
        fmtUsdc(onchainAfterRefund.totalClaimed),
      );
      printDiff("payer USDC balance", fmtUsdc(usdcBeforeRefund), fmtUsdc(usdcAfterRefund));

      // The contract's `balance` is the running deposit counter — it only decrements
      // on refund/withdraw, not on claim. After a full cooperative refund the
      // channel's available escrow (balance - totalClaimed) is zero, but `balance`
      // itself equals the cumulative `totalClaimed` left in place for replay
      // protection on subsequent claims/refunds.
      const availableAfterRefund = onchainAfterRefund.balance - onchainAfterRefund.totalClaimed;
      assertInvariant(
        "available escrow drained (balance - totalClaimed === 0)",
        availableAfterRefund === 0n,
        `balance=${onchainAfterRefund.balance}, totalClaimed=${onchainAfterRefund.totalClaimed}`,
      );
      assertInvariant(
        "payer USDC increased after refund",
        usdcAfterRefund > usdcBeforeRefund,
        `${usdcBeforeRefund} -> ${usdcAfterRefund}`,
      );
      results.push({
        phase: 4,
        name: "Cooperative refund",
        expected: "server claims, signs refund, available escrow returns to payer",
        actual: `available ${fmtUsdc(onchainAfterClaim.balance - onchainAfterClaim.totalClaimed)} -> 0; payer +${fmtUsdc(usdcAfterRefund - usdcBeforeRefund)}`,
        passed: true,
      });
    }

    // Phase 5: unilateral withdraw after server goes dark.
    {
      phaseHeader(5, "Unilateral withdraw — payer reclaims after server goes dark");
      const channel2Salt = keccak256(toBytes(`x402-batch-settlement-demo:phase5:${Date.now()}`));
      const storage2 = new InspectableClientStorage();
      const client2 = buildPaymentClient(env.payerAccount, storage2, channel2Salt, env.rpcUrl);
      const url2 = `${server.url}${server.endpointPath}`;

      const config2 = client2.scheme.buildChannelConfig({
        scheme: "batch-settlement",
        network: NETWORK,
        payTo: env.receiverAddress,
        amount: "1",
        asset: USDC_BASE_SEPOLIA,
        maxTimeoutSeconds: 60,
        extra: {
          receiverAuthorizer: env.receiverAuthorizerAccount.address,
          withdrawDelay: WITHDRAW_DELAY_SECS,
        },
      } as Parameters<typeof client2.scheme.buildChannelConfig>[0]);
      const channel2Id = computeChannelId(config2, NETWORK);
      console.log(`  Opening channel ${channel2Id} (salt=${config2.salt})`);

      // Two requests: open + one steady. Verifies the channel is funded before we kill the server.
      for (let i = 1; i <= 2; i++) {
        const r = await paidRequest(client2.fetchWithPayment, client2.httpClient, url2);
        if (r.kind !== "success") {
          throw new Error(`Phase 5 request ${i} failed: ${JSON.stringify(r.result)}`);
        }
      }
      const stateBeforeKill = await readOnchainChannelState(publicClient, channel2Id);
      console.log(
        `  channel funded: balance=${fmtUsdc(stateBeforeKill.balance)} totalClaimed=${fmtUsdc(stateBeforeKill.totalClaimed)}`,
      );

      console.log("\n  Killing the resource server (simulating it going dark)…");
      await server.shutdown({ flush: false });
      server = null;

      // Build a wallet client to talk directly to the contract.
      const wallet = createBaseSepoliaWallet(env.payerAccount, env.rpcUrl);
      const tuple: ChannelConfigTuple = [
        config2.payer as Address,
        config2.payerAuthorizer as Address,
        config2.receiver as Address,
        config2.receiverAuthorizer as Address,
        config2.token as Address,
        config2.withdrawDelay,
        config2.salt as Hex,
      ];

      console.log("\n  Calling initiateWithdraw onchain — no server signature required…");
      const initiateTx = await initiateWithdraw(
        wallet,
        env.payerAccount,
        tuple,
        stateBeforeKill.balance,
      );
      console.log(`  initiateWithdraw tx: ${initiateTx}`);
      await wallet.waitForTransactionReceipt({ hash: initiateTx });
      // See Phase 4 comment: pin readback to the receipt's block to defeat
      // load-balanced-RPC staleness.
      const initiateReceipt = await publicClient.waitForTransactionReceipt({
        hash: initiateTx,
      });

      const stateAfterInit = await readOnchainChannelState(
        publicClient,
        channel2Id,
        initiateReceipt.blockNumber,
      );
      console.log(
        `  pendingWithdrawals: amount=${fmtUsdc(stateAfterInit.pendingWithdrawAmount)} initiatedAt=${stateAfterInit.pendingWithdrawInitiatedAt} (epoch s)`,
      );
      assertInvariant(
        "pending withdraw recorded for full balance",
        stateAfterInit.pendingWithdrawAmount === stateBeforeKill.balance,
        `pending=${stateAfterInit.pendingWithdrawAmount}, expected=${stateBeforeKill.balance}`,
      );
      assertInvariant(
        "withdraw initiation timestamp set",
        stateAfterInit.pendingWithdrawInitiatedAt > 0,
      );

      console.log("\n  Calling finalizeWithdraw before delay elapses — expect revert…");
      let earlyFinalizeReverted = false;
      try {
        const earlyTx = await finalizeWithdraw(wallet, env.payerAccount, tuple);
        await wallet.waitForTransactionReceipt({ hash: earlyTx });
      } catch (err) {
        earlyFinalizeReverted = true;
        const message = err instanceof Error ? err.message : String(err);
        const firstLine = message.split("\n")[0]?.slice(0, 200) ?? "(no message)";
        console.log(`  early finalize reverted as expected: ${firstLine}`);
      }
      assertInvariant("early finalize reverted (delay not elapsed)", earlyFinalizeReverted);

      let phase5ActualSummary: string;
      if (env.waitFullWithdraw) {
        const elapsedSecs = Math.max(
          0,
          Math.floor(Date.now() / 1000) - stateAfterInit.pendingWithdrawInitiatedAt,
        );
        const remainingSecs = Math.max(0, WITHDRAW_DELAY_SECS - elapsedSecs) + 5; // small buffer
        console.log(
          `\n  WAIT_FULL_WITHDRAW=true — sleeping ${remainingSecs}s for the contract delay to elapse…`,
        );
        await sleep(remainingSecs * 1000);

        const usdcBeforeFinalize = await readErc20Balance(
          publicClient,
          USDC_BASE_SEPOLIA,
          env.payerAccount.address,
        );
        const finalizeTx = await finalizeWithdraw(wallet, env.payerAccount, tuple);
        console.log(`  finalizeWithdraw tx: ${finalizeTx}`);
        await wallet.waitForTransactionReceipt({ hash: finalizeTx });
        // See Phase 4 comment: pin readbacks to the receipt's block to defeat
        // load-balanced-RPC staleness.
        const finalizeReceipt = await publicClient.waitForTransactionReceipt({
          hash: finalizeTx,
        });

        const stateAfterFinalize = await readOnchainChannelState(
          publicClient,
          channel2Id,
          finalizeReceipt.blockNumber,
        );
        const usdcAfterFinalize = await readErc20Balance(
          publicClient,
          USDC_BASE_SEPOLIA,
          env.payerAccount.address,
          finalizeReceipt.blockNumber,
        );
        printDiff(
          "onchain.balance",
          fmtUsdc(stateAfterInit.balance),
          fmtUsdc(stateAfterFinalize.balance),
        );
        printDiff(
          "onchain.pendingWithdraw",
          fmtUsdc(stateAfterInit.pendingWithdrawAmount),
          fmtUsdc(stateAfterFinalize.pendingWithdrawAmount),
        );
        printDiff("payer USDC", fmtUsdc(usdcBeforeFinalize), fmtUsdc(usdcAfterFinalize));

        assertInvariant(
          "pending withdraw cleared after finalize",
          stateAfterFinalize.pendingWithdrawAmount === 0n,
        );
        // The contract's `balance` is the running deposit counter — it only decrements
        // on refund/withdraw, not on claim. After a full unilateral finalize-withdraw
        // the channel's available escrow (balance - totalClaimed) is zero, but `balance`
        // itself equals the cumulative `totalClaimed` left in place for replay
        // protection on subsequent claims/refunds.
        const availableAfterFinalize = stateAfterFinalize.balance - stateAfterFinalize.totalClaimed;
        assertInvariant(
          "available escrow drained after finalize (balance - totalClaimed === 0)",
          availableAfterFinalize === 0n,
          `balance=${stateAfterFinalize.balance}, totalClaimed=${stateAfterFinalize.totalClaimed}`,
        );
        assertInvariant(
          "payer USDC increased after finalize",
          usdcAfterFinalize > usdcBeforeFinalize,
        );
        phase5ActualSummary = `initiate + ${WITHDRAW_DELAY_SECS}s wait + finalize; payer +${fmtUsdc(usdcAfterFinalize - usdcBeforeFinalize)}`;
      } else {
        console.log(
          `\n  WAIT_FULL_WITHDRAW=false — skipping the ${WITHDRAW_DELAY_SECS}s delay. ` +
            `In production the payer waits ${WITHDRAW_DELAY_SECS}s, then calls finalizeWithdraw to receive the funds.`,
        );
        phase5ActualSummary = `initiate proven; finalize blocked by delay (skipped wait — set WAIT_FULL_WITHDRAW=true to run end-to-end)`;
      }

      results.push({
        phase: 5,
        name: "Unilateral withdraw",
        expected:
          "payer initiates onchain withdraw with no server, finalize reverts pre-delay, succeeds post-delay",
        actual: phase5ActualSummary,
        passed: true,
      });
    }

    return results;
  } finally {
    if (server) await server.shutdown({ flush: false }).catch(() => {});
    await facilitator.shutdown().catch(() => {});
  }
}

main()
  .then(results => {
    printSummary(results);
    process.exit(results.every(r => r.passed) ? 0 : 1);
  })
  .catch(err => {
    console.error("\nDemo failed:", err);
    process.exit(1);
  });
