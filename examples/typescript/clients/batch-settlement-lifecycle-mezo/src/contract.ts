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
  }) => Promise<unknown>;
}

/** Deployed batch-settlement contract address (canonical CREATE2 — same on every supported chain, including Mezo Testnet). */
export const BATCH_SETTLEMENT_ADDRESS: Address = "0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003";

/** Mezo Testnet mUSD token (18 decimals; supports Permit2 + EIP-2612, not EIP-3009). */
export const MEZO_MUSD: Address = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";

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
 * @param publicClient - Mezo Testnet public client.
 * @param channelId - The bytes32 channel id to query.
 * @returns Composite snapshot with balance, claimed amount, and pending withdraw info.
 */
export async function readOnchainChannelState(
  publicClient: ReadContractClient,
  channelId: Hex,
): Promise<OnchainChannelState> {
  const [channelTuple, pendingTuple] = await Promise.all([
    publicClient.readContract({
      address: BATCH_SETTLEMENT_ADDRESS,
      abi: batchSettlementAbi,
      functionName: "channels",
      args: [channelId],
    }),
    publicClient.readContract({
      address: BATCH_SETTLEMENT_ADDRESS,
      abi: batchSettlementAbi,
      functionName: "pendingWithdrawals",
      args: [channelId],
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
 * @param publicClient - Mezo Testnet public client.
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
 * Reads the payer's mUSD balance.
 *
 * @param publicClient - Mezo Testnet public client.
 * @param token - Token address.
 * @param holder - Wallet whose balance is read.
 * @returns Balance in token base units.
 */
export async function readErc20Balance(
  publicClient: ReadContractClient,
  token: Address,
  holder: Address,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: token,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [holder],
  })) as bigint;
}
