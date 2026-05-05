# Batch-Settlement Lifecycle Demo (5 phases)

End-to-end orchestrator that drives the **batch-settlement** EVM scheme on Base Sepolia through every interesting state of its lifecycle, including failure modes:

| Phase | Name | What it exercises |
|-------|------|-------------------|
| 1 | **Open** | First paid request bundles a deposit; channel becomes funded onchain. |
| 2 | **Steady-state** | Five paid requests at random charges; vouchers grow but no onchain claim happens yet. |
| 3 | **State-loss recovery** | Wipes client storage mid-session; demonstrates the corrective-402 + signature-validated resync path. |
| 4 | **Cooperative refund** | Forces `claimAndSettle()`; then `scheme.refund(url)` returns the remaining balance to the payer. |
| 5 | **Unilateral withdraw** | Opens a second channel, simulates the resource server going dark, and uses the contract's `initiateWithdraw` / `finalizeWithdraw` path with no server signature. |

The orchestrator runs facilitator + resource server + client all in one Node process. No three-terminal setup required.

## Prerequisites

- Node.js v20+, pnpm 10
- A Base Sepolia EOA funded with **USDC** (deposits + voucher source) and a small amount of **ETH** (gas for facilitator-relayed deposits/claims/settles/refunds + the unilateral withdraw transaction).
  - Faucets: <https://faucet.circle.com> (USDC), <https://faucet.quicknode.com/base/sepolia> (ETH).
- The repository workspace must be built once so `@x402/evm/batch-settlement/*` and friends resolve as `workspace:*` deps.

## Setup

```bash
# Build the SDK once.
cd ../../../../typescript
pnpm install
pnpm -r run build

# Wire the example.
cd ../examples/typescript/clients/batch-settlement-lifecycle
cp .env-local .env
# Fill EVM_PRIVATE_KEY (and optionally EVM_RECEIVER_AUTHORIZER_PRIVATE_KEY / EVM_RECEIVER_ADDRESS).
pnpm install
pnpm dev
```

The orchestrator prints a banner per phase, a state-diff after each step, asserts invariants, and ends with a summary table:

```
==================================================================
=== SUMMARY ===
==================================================================

[PASS] PHASE 1: Open
       expected: deposit funded the channel; first voucher matched the random server charge
       actual:   balance=$0.05 (50000 base units), chargedCumulative=$0.0042 (4200 base units)
…
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `EVM_PRIVATE_KEY` | yes | Payer key. Also drives the in-process facilitator's relayer. Must hold USDC + ETH on Base Sepolia. |
| `EVM_RECEIVER_AUTHORIZER_PRIVATE_KEY` | no | Dedicated authorizer for `ClaimBatch` / `Refund` EIP-712 signatures. Defaults to `EVM_PRIVATE_KEY`. |
| `EVM_RECEIVER_ADDRESS` | no | `payTo` address. Defaults to a deterministic hash derived from the payer — guarantees payer ≠ receiver without requiring a second funded key. |
| `EVM_RPC_URL` | no | Override Base Sepolia RPC URL. |
| `WAIT_FULL_WITHDRAW` | no | If `true`, Phase 5 sleeps for the contract's 900s `withdrawDelay` and finalizes onchain. Default: skip the wait and just demonstrate that finalize reverts pre-delay. |

## What to look for

### Phase 1
The first request triggers a `deposit` payload (EIP-3009). After the request, the contract's `channels(channelId)` returns a non-zero `balance`. The server's in-memory channel record now tracks `chargedCumulativeAmount = first random charge` and the signed voucher cap.

### Phase 2
Each request grows `chargedCumulativeAmount` and `signedMaxClaimable` monotonically. **`onchain.totalClaimed` stays at 0** — that is the entire point of batch settlement: receivers do not pay one onchain transaction per request. The auto-claim job interval is set to 24 h so the demo can verify this directly.

### Phase 3
We wipe the local `ClientChannelStorage`. The next request signs a voucher that disagrees with the server's cumulative state, so the server returns a corrective `402 PAYMENT-REQUIRED` containing `accept.extra.channelState` and `accept.extra.voucherState`. The client validates the embedded voucher signature came from its own key, accepts the resync, and retries exactly once. After the retry, `local.chargedCumulativeAmount === server.chargedCumulativeAmount` again and the demo's invariants hold.

### Phase 4
We force `channelManager.claimAndSettle()` so the receiver actually moves funds onchain. Then `scheme.refund(url)` triggers the cooperative path: server claims any leftover voucher delta, signs `refundWithSignature`, and the contract's `balance` for the channel drops to 0 while the payer's USDC wallet recovers. Invariants assert the payer wallet went up.

### Phase 5
We open a fresh channel (different salt), do two paid requests, then **shut down the resource server**. The payer never needs the server again — they call `initiateWithdraw(config, balance)` directly via viem. `pendingWithdrawals(channelId)` confirms the request landed. We then call `finalizeWithdraw` immediately to demonstrate that the contract enforces the delay (the tx reverts). Setting `WAIT_FULL_WITHDRAW=true` will sleep for 905 seconds and run finalize successfully end-to-end.

This is the trust boundary: **the receiver cannot freeze a payer's deposit indefinitely.** As long as the payer waits `withdrawDelay`, they reclaim everything the server has not yet claimed.

## What would indicate a real failure mode

| Symptom | What it means |
|---------|---------------|
| Phase 1 fails on `paid request` | The facilitator could not relay the deposit. Check ETH balance on the payer / `EVM_RPC_URL` reachability. |
| Phase 2 invariant `client and server cumulative agree` fails | Voucher mismatch — usually a `setSettlementOverrides` regression in the resource server. |
| Phase 2 invariant `onchain.totalClaimed still 0` fails | The auto-claim job ran. Indicates a regression in the channel manager interval handling. |
| Phase 3 invariant `client and server cumulative agree post-recovery` fails | The corrective-402 path did not include voucher state, or the client refused to accept the resync (possible signature-validation regression in `processCorrectivePaymentRequired`). |
| Phase 4 `payer USDC increased` fails | The refund did not actually return funds — possible regression in `refundWithSignature` or in the channel manager's pre-refund claim. |
| Phase 5 `early finalize reverted` fails | The contract did not enforce the delay — major issue, payer trust assumption violated. |
| Phase 5 final-balance assertions fail (`WAIT_FULL_WITHDRAW=true`) | Funds did not return after the delay — payer is stuck. Major issue. |

## See also

- [Batch-Settlement EVM scheme spec](../../../../specs/schemes/batch-settlement/scheme_batch_settlement_evm.md)
- [SDK package README](../../../../typescript/packages/mechanisms/evm/src/batch-settlement/README.md)
- Existing single-purpose examples: [client](../batch-settlement), [server](../../servers/batch-settlement), [facilitator](../../facilitator/batch-settlement)
