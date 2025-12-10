# Installation Instructions

## Prerequisites

Ensure Foundry is installed:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Install Dependencies

Run these commands from the `contracts/` directory:

```bash
# Install forge-std
forge install foundry-rs/forge-std --no-commit

# Install Permit2
forge install Uniswap/permit2 --no-commit

# Install OpenZeppelin Contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Install OpenZeppelin Upgradeable Contracts
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit

# Install Solmate
forge install transmissions11/solmate --no-commit
```

## Build

```bash
forge build
```

Expected output:
```
[⠊] Compiling...
[⠒] Compiling 50 files with 0.8.17
[⠢] Solc 0.8.17 finished in X.XXs
Compiler run successful!
```

## Run Tests

```bash
forge test
```

Expected output:
```
Running 10 tests for test/X402Settlement.t.sol:X402SettlementTest
[PASS] testConstants() (gas: XXXX)
[PASS] testExecutePayment() (gas: XXXX)
[PASS] testExecutePaymentRevertsOnNonceReuse() (gas: XXXX)
[PASS] testExecutePaymentRevertsWhenExpired() (gas: XXXX)
[PASS] testExecutePaymentWithDifferentAmounts(uint256) (runs: 256, μ: XXXX, ~: XXXX)
[PASS] testInitialization() (gas: XXXX)
[PASS] testMultiplePayments() (gas: XXXX)
[PASS] testPaymentExecutedEvent() (gas: XXXX)
[PASS] testReentrancyProtection() (gas: XXXX)
[PASS] testWitnessEnforcesRecipient() (gas: XXXX)

Test result: ok. 10 passed; 0 failed; 0 skipped; finished in X.XXs
```

## Troubleshooting

### Submodule Issues

If you get git submodule errors:
```bash
git submodule update --init --recursive
```

### Compilation Errors

If you get import errors, verify remappings:
```bash
forge remappings
```

Should show:
```
forge-std/=lib/forge-std/src/
permit2/=lib/permit2/
openzeppelin-contracts/=lib/openzeppelin-contracts/contracts/
openzeppelin-contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/
solmate/=lib/solmate/src/
```

### Clean Build

If you encounter persistent issues:
```bash
forge clean
forge build
```

## Quick Start Script

For convenience, use the provided script:
```bash
chmod +x install.sh
./install.sh
```
