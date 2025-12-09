# Gas Analysis: x402 Payment Methods

Benchmark comparison of gas costs for different payment methods in x402.

## Methodology

- **Network**: Base Sepolia fork (chain ID: 84532)
- **Tool**: Foundry `forge test` with `-vvv` gas reporting
- **Test File**: `contracts/test/GasBenchmark.t.sol`
- **Date**: December 2024

All tests use the real Permit2 contract at `0x000000000022D473030F116dDEE9F6B43aC78BA3` and WETH at `0x4200000000000000000000000000000000000006`.

## Benchmark Results

| Payment Method | Gas Used | Notes |
|----------------|----------|-------|
| **EIP-3009** (`transferWithAuthorization`) | ~65,000* | *Estimated from mainnet USDC |
| **Permit2 Direct** (`permitTransferFrom`) | 71,012 | Measured on Base Sepolia fork |
| **Permit2 + Settlement** (`executePayment`) | 117,797 | Measured on Base Sepolia fork |

### Settlement Contract Overhead

| Metric | Value |
|--------|-------|
| Overhead vs Permit2 Direct | +46,785 gas |
| Overhead Percentage | +65.9% |
| Overhead vs EIP-3009 | +52,797 gas |

## Analysis

### Why Settlement Contract Costs More

The settlement contract adds gas overhead for:

1. **Two-hop transfer pattern** (~29,000 gas)
   - Tokens flow: Payer → Settlement Contract → Recipient
   - Two `safeTransfer` calls instead of one

2. **Witness hash computation** (~3,000 gas)
   - `keccak256` of PaymentOrder struct
   - Additional EIP-712 type validation in Permit2

3. **Event emission** (~2,500 gas)
   - `PaymentExecuted` event with 6 indexed/non-indexed fields

4. **Reentrancy guard** (~200 gas)
   - SSTORE operations for mutex

5. **Deadline validation** (~200 gas)
   - `block.timestamp` comparison

### Gas Breakdown (Approximate)

```
Permit2 Direct:                          71,012 gas
  └─ permitTransferFrom                  71,012 gas

Permit2 + Settlement:                   117,797 gas
  ├─ executePayment entry                    ~500 gas
  ├─ Deadline check                          ~200 gas
  ├─ Witness hash computation              ~3,000 gas
  ├─ permitWitnessTransferFrom            ~85,000 gas
  │   └─ (includes witness verification)
  ├─ safeTransfer to recipient            ~26,000 gas
  ├─ PaymentExecuted event                 ~2,500 gas
  └─ Reentrancy guard                        ~200 gas
```

## Trust-Minimization Value

The ~47k gas overhead provides:

| Security Guarantee | Without Settlement | With Settlement |
|--------------------|-------------------|-----------------|
| Recipient bound in signature | No | Yes |
| Facilitator can redirect funds | Yes | No |
| On-chain enforcement | None | Contract enforces |

**The security benefit of trust-minimization justifies the gas overhead.**

## Cost Estimates (Informational)

Gas costs vary by network conditions. Here are example calculations at different gas prices:

| Gas Price | Settlement Cost | Direct Permit2 Cost | Overhead Cost |
|-----------|-----------------|---------------------|---------------|
| 0.001 gwei (L2) | ~0.000000118 ETH | ~0.000000071 ETH | ~0.000000047 ETH |
| 1 gwei | ~0.000118 ETH | ~0.000071 ETH | ~0.000047 ETH |
| 10 gwei | ~0.00118 ETH | ~0.00071 ETH | ~0.00047 ETH |

On L2s like Base, the overhead is typically <$0.01 at current gas prices.

## EIP-3009 Note

EIP-3009 (`transferWithAuthorization`) gas could not be measured directly on Base Sepolia because the test USDC contract (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) uses a different implementation without EIP-3009 support.

The ~65,000 gas estimate is based on:
- Mainnet USDC transaction analysis
- Circle's FiatToken implementation documentation

For accurate EIP-3009 benchmarking, use Ethereum mainnet or Sepolia with the official Circle USDC deployment.

## Reproducing Results

```bash
cd contracts

# Run individual benchmarks
forge test --match-test testGas_Permit2_Direct --fork-url https://sepolia.base.org -vvv
forge test --match-test testGas_Permit2_Settlement --fork-url https://sepolia.base.org -vvv

# Run summary (requires EIP-3009 compatible token)
forge test --match-test testGas_Summary --fork-url https://sepolia.base.org -vvv
```

## Conclusion

The Permit2 + Settlement approach costs approximately **47k more gas** than direct Permit2 transfers. This overhead is the cost of trust-minimization:

- **Direct Permit2**: Cheaper, but facilitator controls recipient
- **Settlement Contract**: More expensive, but recipient cryptographically enforced

For x402's trust-minimizing design principles, the settlement contract overhead is an acceptable tradeoff.
