import { type Account, type Address, type Hex, type WalletClient, parseAbi } from "viem";

/**
 * Minimal structural type for an object with viem's `readContract` shape.
 * The example deliberately avoids the full `PublicClient<...>` generic because
 * differing viem versions across workspace packages produce incompatible
 * generic instantiations at the call sites.
 */
export interface ReadContractClient {
  /** Reads a contract method via viem's `readContract`. */
  readContract: (args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    blockNumber?: bigint;
  }) => Promise<unknown>;
}

/** Deployed batch-settlement contract address (same on Base Mainnet and Base Sepolia). */
export const BATCH_SETTLEMENT_ADDRESS: Address = "0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003";

/** Base Sepolia USDC token (used by the batch-settlement examples). */
export const USDC_BASE_SEPOLIA: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/**
 * Subset of the batchSettlement ABI used by the demo for direct read/write calls.
 * Mirrors {@link typescript/packages/mechanisms/evm/src/batch-settlement/abi.ts} but
 * is hand-rolled here so the example does not import private package internals.
 */
export const batchSettlementAbi = parseAbi([
  "struct ChannelConfig { address payer; address payerAuthorizer; address receiver; address receiverAuthorizer; address token; uint40 withdrawDelay; bytes32 salt; }",
  "function channels(bytes32 channelId) view returns (uint128 balance, uint128 totalClaimed)",
  "function pendingWithdrawals(bytes32 channelId) view returns (uint128 amount, uint40 initiatedAt)",
  "function receivers(address receiver, address token) view returns (uint128 totalClaimed, uint128 totalSettled)",
  "function initiateWithdraw((address,address,address,address,address,uint40,bytes32) config, uint128 amount)",
  "function finalizeWithdraw((address,address,address,address,address,uint40,bytes32) config)",
]);

/** Tuple form for ChannelConfig used with viem's auto-generated tuple call style. */
export type ChannelConfigTuple = readonly [
  Address, // payer
  Address, // payerAuthorizer
  Address, // receiver
  Address, // receiverAuthorizer
  Address, // token
  number, // withdrawDelay (uint40)
  Hex, // salt (bytes32)
];

/** viem `readContract` parameters as accepted by {@link ReadContractClient}. */
type ReadContractParams = Parameters<ReadContractClient["readContract"]>[0];

/**
 * Reads a contract method with retry on "block not found" errors.
 *
 * When `blockNumber` pins a read to a specific block on a load-balanced
 * public RPC, the request can land on a node that has not yet ingested
 * that block — viem surfaces this as ResourceNotFoundRpcError(-32001) with
 * `details: 'block not found: 0x...'`. The lagging node typically catches
 * up within a few hundred ms, so we retry with backoff. Errors unrelated
 * to block availability (and any failure when no `blockNumber` was passed)
 * propagate immediately.
 *
 * @param publicClient - Public client used to issue the read.
 * @param params - viem `readContract` parameters, including optional `blockNumber` pin.
 * @returns The decoded return value of the contract call.
 */
async function readContractWithBlockSync(
  publicClient: ReadContractClient,
  params: ReadContractParams,
): Promise<unknown> {
  const maxAttempts = 14;
  const baseDelayMs = 200;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await publicClient.readContract(params);
    } catch (err) {
      if (params.blockNumber === undefined) throw err;
      const message = err instanceof Error ? err.message : String(err);
      const details = (err as { details?: unknown })?.details;
      const detailsStr = typeof details === "string" ? details : "";
      const isBlockNotFound =
        message.includes("block not found") || detailsStr.includes("block not found");
      if (!isBlockNotFound) throw err;
      lastErr = err;
      if (attempt === maxAttempts - 1) break;
      const delay = Math.min(baseDelayMs * Math.pow(1.5, attempt), 2000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

/**
 * Snapshot of one channel's onchain accounting.
 */
export interface OnchainChannelState {
  /** Currently available balance for vouchers (uint128). */
  balance: bigint;
  /** Cumulative amount the receiver has already claimed onchain (uint128). */
  totalClaimed: bigint;
  /** Pending unilateral withdraw amount, or 0 if none in progress. */
  pendingWithdrawAmount: bigint;
  /** Block timestamp (seconds) when the unilateral withdraw was initiated, or 0. */
  pendingWithdrawInitiatedAt: number;
}

/**
 * Reads the onchain channel state — both `channels()` and `pendingWithdrawals()`.
 *
 * @param publicClient - Base Sepolia public client.
 * @param channelId - The bytes32 channel id to query.
 * @param blockNumber - Optional block to pin both reads to. Use the receipt
 *   blockNumber from a mutating tx to defeat load-balanced-RPC staleness
 *   where a follow-up `latest` read can land on a node still 1 block behind.
 * @returns Composite snapshot with balance, claimed amount, and pending withdraw info.
 */
export async function readOnchainChannelState(
  publicClient: ReadContractClient,
  channelId: Hex,
  blockNumber?: bigint,
): Promise<OnchainChannelState> {
  const [channelTuple, pendingTuple] = await Promise.all([
    readContractWithBlockSync(publicClient, {
      address: BATCH_SETTLEMENT_ADDRESS,
      abi: batchSettlementAbi,
      functionName: "channels",
      args: [channelId],
      blockNumber,
    }),
    readContractWithBlockSync(publicClient, {
      address: BATCH_SETTLEMENT_ADDRESS,
      abi: batchSettlementAbi,
      functionName: "pendingWithdrawals",
      args: [channelId],
      blockNumber,
    }),
  ]);

  const [balance, totalClaimed] = channelTuple as readonly [bigint, bigint];
  const [pendingAmount, pendingInitiatedAt] = pendingTuple as readonly [bigint, number];
  return {
    balance,
    totalClaimed,
    pendingWithdrawAmount: pendingAmount,
    pendingWithdrawInitiatedAt: Number(pendingInitiatedAt),
  };
}

/**
 * Reads cumulative receiver-level totals from the contract.
 *
 * @param publicClient - Base Sepolia public client.
 * @param receiver - Receiver address.
 * @param token - Token address.
 * @returns `{ totalClaimed, totalSettled }` for the receiver/token pair.
 */
export async function readReceiverTotals(
  publicClient: ReadContractClient,
  receiver: Address,
  token: Address,
): Promise<{ totalClaimed: bigint; totalSettled: bigint }> {
  const [totalClaimed, totalSettled] = (await publicClient.readContract({
    address: BATCH_SETTLEMENT_ADDRESS,
    abi: batchSettlementAbi,
    functionName: "receivers",
    args: [receiver, token],
  })) as readonly [bigint, bigint];
  return { totalClaimed, totalSettled };
}

/**
 * Calls `initiateWithdraw(config, amount)` from the payer wallet.
 *
 * @param walletClient - Wallet client signing as the payer.
 * @param account - Payer account.
 * @param config - Channel config tuple matching the channel's commitments.
 * @param amount - Amount in token base units to mark for withdraw.
 * @returns The submitted transaction hash.
 */
export async function initiateWithdraw(
  walletClient: WalletClient,
  account: Account,
  config: ChannelConfigTuple,
  amount: bigint,
): Promise<Hex> {
  return walletClient.writeContract({
    account,
    address: BATCH_SETTLEMENT_ADDRESS,
    abi: batchSettlementAbi,
    functionName: "initiateWithdraw",
    args: [config, amount],
    chain: walletClient.chain,
  });
}

/**
 * Calls `finalizeWithdraw(config)` from the payer wallet. Reverts if the
 * `withdrawDelay` window has not yet elapsed.
 *
 * @param walletClient - Wallet client signing as the payer.
 * @param account - Payer account.
 * @param config - Channel config tuple matching the channel's commitments.
 * @returns The submitted transaction hash.
 */
export async function finalizeWithdraw(
  walletClient: WalletClient,
  account: Account,
  config: ChannelConfigTuple,
): Promise<Hex> {
  return walletClient.writeContract({
    account,
    address: BATCH_SETTLEMENT_ADDRESS,
    abi: batchSettlementAbi,
    functionName: "finalizeWithdraw",
    args: [config],
    chain: walletClient.chain,
  });
}

/**
 * Reads the payer's USDC balance.
 *
 * @param publicClient - Base Sepolia public client.
 * @param token - Token address.
 * @param holder - Wallet whose balance is read.
 * @param blockNumber - Optional block to pin the read to (see
 *   {@link readOnchainChannelState} for rationale).
 * @returns Balance in token base units.
 */
export async function readErc20Balance(
  publicClient: ReadContractClient,
  token: Address,
  holder: Address,
  blockNumber?: bigint,
): Promise<bigint> {
  return (await readContractWithBlockSync(publicClient, {
    address: token,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [holder],
    blockNumber,
  })) as bigint;
}
