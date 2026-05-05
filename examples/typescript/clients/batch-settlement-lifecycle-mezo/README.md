# Batch-Settlement Lifecycle Demo on Mezo Testnet (5 phases)

End-to-end orchestrator that drives the **batch-settlement** EVM scheme on **Mezo Testnet** (`eip155:31611`) through every interesting state of its lifecycle, including failure modes. This is a sibling of the Base Sepolia version under [`../batch-settlement-lifecycle/`](../batch-settlement-lifecycle/) — same orchestration, different network and asset.

| Phase | Name | What it exercises |
|-------|------|-------------------|
| 1 | **Open** | First paid request bundles a deposit; channel becomes funded onchain. |
| 2 | **Steady-state** | Five paid requests at random charges; vouchers grow but no onchain claim happens yet. |
| 3 | **State-loss recovery** | Wipes client storage mid-session; demonstrates the corrective-402 + signature-validated resync path. |
| 4 | **Cooperative refund** | Forces `claimAndSettle()`; then `scheme.refund(url)` returns the remaining balance to the payer. |
| 5 | **Unilateral withdraw** | Opens a second channel, simulates the resource server going dark, and uses the contract's `initiateWithdraw` / `finalizeWithdraw` path with no server signature. |

The orchestrator runs facilitator + resource server + client all in one Node process. No three-terminal setup required.

## Why a separate demo for Mezo?

Mezo has two material differences from Base Sepolia that affect the demo wiring:

- **Asset**: mUSD (`0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`) at **18 decimals**, not 6 like USDC. All amount math and the formatter use 18 decimals.
- **Deposit transfer method**: mUSD does **not** support EIP-3009 — the `extra.assetTransferMethod` is set explicitly to `"permit2"`. (The SDK defaults to `"eip3009"` if the requirement omits the field.) Mezo's mUSD does support EIP-2612 permit, which Permit2 uses internally for the gasless deposit.

Beyond that, the protocol behavior is identical: the same canonical `x402BatchSettlement` contract address is used, the same channel-lifecycle invariants hold, and the same orchestrator drives all five phases.

## Mezo Testnet deployment (Path A: vanity-canonical CREATE2)

The batch-settlement contracts were deployed to Mezo Testnet via the deterministic CREATE2 deployer used for the canonical Base Sepolia / Base Mainnet deploy, so the SDK's hardcoded `BATCH_SETTLEMENT_ADDRESS` and `PERMIT2_DEPOSIT_COLLECTOR_ADDRESS` resolve to the same bytecode.

| Contract | Address | Deploy tx | Block |
|----------|---------|-----------|-------|
| `x402BatchSettlement` | `0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003` | `0x822394e882b528725689b89ed5043d220f421a284b1eb89dcd3451c9da8e8eb6` | 12,840,393 |
| `Permit2DepositCollector` | `0x4020425FAf3B746C082C2f942b4E5159887B0005` | `0xd5c356ce4a6ec60df221dc2057131031b35b168eb9f4f127e237d55889883958` | 12,840,395 |
| `ERC3009DepositCollector` | `0x4020806089470a89826cB9fB1f4059150b550004` | `0xd0fbb37b4ebe4c8bc23ae1adb88d079c07a0ed0e7f7e06064300a9cc45dadefb` | 12,840,394 |

Notes:
- `ERC3009DepositCollector` is included for parity with the canonical address layout but is **not exercised** by this demo — Mezo mUSD does not implement EIP-3009.
- Source: [coinbase/x402#1950 `feat/evm-contracts-batch-settlement` @ `86352900`](https://github.com/coinbase/x402/pull/1950) — `contracts/evm/script/DeployBatchSettlement.s.sol`. Reproduce with `forge build && forge script script/DeployBatchSettlement.s.sol --rpc-url https://rpc.test.mezo.org --broadcast --private-key $DEPLOYER_PRIVATE_KEY` against a deployer EOA that holds Mezo Testnet BTC for gas.
- Verifier: explorer at <https://explorer.test.mezo.org> exposes the bytecode and the constructor calldata for each address.

## Prerequisites

- Node.js v20+, pnpm 10.
- Foundry (`forge`/`cast`) only if you want to redeploy the contracts yourself; not required to run the demo.
- A Mezo Testnet EOA funded with **mUSD** (deposits + voucher source) and a small amount of **BTC** (gas for facilitator-relayed deposits/claims/settles/refunds + the unilateral withdraw transaction).
  - Faucet: <https://faucet.test.mezo.org/> — issues both Mezo Testnet BTC and mUSD to a supplied address.
- The repository workspace must be built once so `@x402/evm/batch-settlement/*` and friends resolve as `workspace:*` deps.

## Setup

```bash
# Build the SDK once.
cd ../../../../typescript
pnpm install
pnpm -r run build

# Wire the example.
cd ../examples/typescript/clients/batch-settlement-lifecycle-mezo
cp .env-local .env
# Fill EVM_PRIVATE_KEY (and optionally EVM_RECEIVER_AUTHORIZER_PRIVATE_KEY / EVM_RECEIVER_ADDRESS).
pnpm install
pnpm dev
```

Expected runtime: ~30 seconds with `WAIT_FULL_WITHDRAW=false` (the default — Phase 5 demonstrates the pre-delay revert and exits). Set `WAIT_FULL_WITHDRAW=true` to add the full 900-second contract delay so Phase 5 finalizes onchain end-to-end.

The orchestrator prints a banner per phase, a state-diff after each step, asserts invariants, and ends with a summary table:

```
==================================================================
=== SUMMARY ===
==================================================================

[PASS] PHASE 1: Open
       expected: deposit funded the channel; first voucher matched the random server charge
       actual:   balance=0.05 mUSD (50000000000000000 base units), chargedCumulative=0.0042 mUSD (4200000000000000 base units)
…
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `EVM_PRIVATE_KEY` | yes | Payer key. Also drives the in-process facilitator's relayer. Must hold mUSD + BTC on Mezo Testnet. |
| `EVM_RECEIVER_AUTHORIZER_PRIVATE_KEY` | no | Dedicated authorizer for `ClaimBatch` / `Refund` EIP-712 signatures. Defaults to `EVM_PRIVATE_KEY`. |
| `EVM_RECEIVER_ADDRESS` | no | `payTo` address. Defaults to a deterministic hash derived from the payer — guarantees payer ≠ receiver without requiring a second funded key. |
| `EVM_RPC_URL` | no | Override Mezo Testnet RPC URL. Defaults to <https://rpc.test.mezo.org>. |
| `WAIT_FULL_WITHDRAW` | no | If `true`, Phase 5 sleeps for the contract's 900s `withdrawDelay` and finalizes onchain. Default: skip the wait and just demonstrate that finalize reverts pre-delay. |

For the maintainer machine running this demo, the test wallet is sourced from `~/gc-secrets/mezo-testnet.env` (paths only — never check the file in or paste its contents). That file defines `PRIVATE_KEY`, `PAYEE_ADDRESS`, `NETWORK=eip155:31611`, and `FACILITATOR_URL` (only `PRIVATE_KEY` and optionally `PAYEE_ADDRESS` are read by this demo, mapped to `EVM_PRIVATE_KEY` and `EVM_RECEIVER_ADDRESS` respectively).

## What to look for

### Phase 1
The first request triggers a `deposit` payload using the **Permit2** path (gasless permit signed offchain by the payer; the relayer submits the deposit transaction). After the request, the contract's `channels(channelId)` returns a non-zero `balance`. The server's in-memory channel record now tracks `chargedCumulativeAmount = first random charge` and the signed voucher cap.

### Phase 2
Each request grows `chargedCumulativeAmount` and `signedMaxClaimable` monotonically. **`onchain.totalClaimed` stays at 0** — that is the entire point of batch settlement: receivers do not pay one onchain transaction per request. The auto-claim job interval is set to 24 h so the demo can verify this directly.

### Phase 3
We wipe the local `ClientChannelStorage`. The next request signs a voucher that disagrees with the server's cumulative state, so the server returns a corrective `402 PAYMENT-REQUIRED` containing `accept.extra.channelState` and `accept.extra.voucherState`. The client validates the embedded voucher signature came from its own key, accepts the resync, and retries exactly once. After the retry, `local.chargedCumulativeAmount === server.chargedCumulativeAmount` again and the demo's invariants hold.

### Phase 4
We force `channelManager.claimAndSettle()` so the receiver actually moves funds onchain. Then `scheme.refund(url)` triggers the cooperative path: server claims any leftover voucher delta, signs `refundWithSignature`, and the contract's `balance` for the channel drops to 0 while the payer's mUSD wallet recovers. Invariants assert the payer wallet went up.

### Phase 5
We open a fresh channel (different salt), do two paid requests, then **shut down the resource server**. The payer never needs the server again — they call `initiateWithdraw(config, balance)` directly via viem. `pendingWithdrawals(channelId)` confirms the request landed. We then call `finalizeWithdraw` immediately to demonstrate that the contract enforces the delay (the tx reverts). Setting `WAIT_FULL_WITHDRAW=true` will sleep for 905 seconds and run finalize successfully end-to-end.

This is the trust boundary: **the receiver cannot freeze a payer's deposit indefinitely.** As long as the payer waits `withdrawDelay`, they reclaim everything the server has not yet claimed.

## What would indicate a real failure mode

| Symptom | What it means |
|---------|---------------|
| Phase 1 fails on `paid request` | The facilitator could not relay the deposit. Check BTC balance on the payer (gas) / `EVM_RPC_URL` reachability / Permit2 signature acceptance. If you see a missing-EIP-3009 error, the demo lost the explicit `assetTransferMethod: "permit2"` override. |
| Phase 2 invariant `client and server cumulative agree` fails | Voucher mismatch — usually a `setSettlementOverrides` regression in the resource server. |
| Phase 2 invariant `onchain.totalClaimed still 0` fails | The auto-claim job ran. Indicates a regression in the channel manager interval handling. |
| Phase 3 invariant `client and server cumulative agree post-recovery` fails | The corrective-402 path did not include voucher state, or the client refused to accept the resync (possible signature-validation regression in `processCorrectivePaymentRequired`). |
| Phase 4 `payer mUSD increased` fails | The refund did not actually return funds — possible regression in `refundWithSignature` or in the channel manager's pre-refund claim. |
| Phase 5 `early finalize reverted` fails | The contract did not enforce the delay — major issue, payer trust assumption violated. |
| Phase 5 final-balance assertions fail (`WAIT_FULL_WITHDRAW=true`) | Funds did not return after the delay — payer is stuck. Major issue. |

## See also

- [Base Sepolia sibling demo](../batch-settlement-lifecycle/) — same orchestration, different network/asset.
- [Batch-Settlement EVM scheme spec](../../../../specs/schemes/batch-settlement/scheme_batch_settlement_evm.md)
- [SDK package README](../../../../typescript/packages/mechanisms/evm/src/batch-settlement/README.md)
- [Mezo Testnet block explorer](https://explorer.test.mezo.org)
