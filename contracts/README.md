# X402 Settlement Contract

Foundry-based settlement contract for trust-minimized Permit2 transfers in the x402 payment protocol.

## Overview

The X402 Settlement contract enables cryptographically enforced token transfers where the recipient is bound to the payment signature via Permit2's witness mechanism. It follows the UniswapX reactor pattern for two-hop transfers:

1. **Permit2 Transfer**: Tokens are transferred from the payer to the settlement contract via Permit2
2. **Immediate Forward**: The contract immediately forwards tokens to the recipient specified in the signed payment order

This design ensures that the recipient address is cryptographically enforced - any attempt to modify the recipient will invalidate the signature.

## Architecture

- **TransparentUpgradeableProxy**: Enables contract upgrades while preserving state
- **X402SettlementV1**: Implementation contract with payment execution logic
- **PaymentOrder Witness**: EIP-712 struct binding payment details to Permit2 signatures

## Contract Addresses

### Permit2 (Canonical)
- **All Networks**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

### Settlement Contract
- **Base Sepolia**: [`0xbC15B94Cb88Ef8462Daa9eb3652478887a9eA976`](https://sepolia.basescan.org/address/0xbC15B94Cb88Ef8462Daa9eb3652478887a9eA976)
- **Ethereum Sepolia**: TBD (deploy using script)

## Installation

```bash
# Install Foundry dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Run tests with gas reporting
forge test --gas-report
```

## Dependencies

- `permit2` - Uniswap's signature-based token transfer protocol
- `openzeppelin-contracts` - Standard proxy patterns
- `openzeppelin-contracts-upgradeable` - Upgradeable contract patterns
- `solmate` - Gas-optimized token transfers
- `forge-std` - Foundry testing utilities

## Deployment

### Local/Testnet Deployment

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export RPC_URL=https://sepolia.base.org

# Deploy to testnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify

# The script will output:
# - Proxy address (use this for interactions)
# - Implementation address
# - ProxyAdmin address
```

### Upgrade Existing Deployment

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export PROXY_ADDRESS=0x...
export PROXY_ADMIN=0x...
export RPC_URL=https://sepolia.base.org

# Deploy new implementation and upgrade
forge script script/Deploy.s.sol:UpgradeScript \
  --rpc-url $RPC_URL \
  --broadcast
```

## Usage

### Payment Flow

1. **Client Creates Payment Order**:
```solidity
IX402Settlement.PaymentOrder memory order = IX402Settlement.PaymentOrder({
    token: 0x4200000000000000000000000000000000000006,  // WETH on Base
    amount: 1000000000000000,  // 0.001 WETH
    recipient: 0x...,  // Server's payment address
    paymentId: keccak256("resource-id"),
    nonce: 12345,
    deadline: block.timestamp + 1 hours
});
```

2. **Client Signs Permit2 Message**:
   - Signs EIP-712 message with PaymentOrder as witness
   - Approves Permit2 to spend tokens (one-time setup)

3. **Execute Payment**:
```solidity
settlement.executePayment(order, payer, signature);
```

### EIP-712 Type String

The witness type string for Permit2 signatures:

```
PaymentOrder witness)PaymentOrder(address token,uint256 amount,address recipient,bytes32 paymentId,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)
```

### Payment Order Struct

```solidity
struct PaymentOrder {
    address token;       // Token to transfer
    uint256 amount;      // Amount to transfer
    address recipient;   // Enforced recipient
    bytes32 paymentId;   // Unique payment identifier
    uint256 nonce;       // Replay protection
    uint256 deadline;    // Signature expiry
}
```

## Testing

The test suite includes:

- ✅ Successful payment execution
- ✅ Deadline expiry handling
- ✅ Nonce reuse prevention
- ✅ Recipient enforcement via witness
- ✅ Event emission verification
- ✅ Multiple sequential payments
- ✅ Reentrancy protection
- ✅ Initialization checks

Run tests:
```bash
forge test -vvv
```

## Security Considerations

1. **Recipient Enforcement**: The recipient address is cryptographically bound via Permit2 witness
2. **Nonce Management**: Unordered nonces prevent replay attacks
3. **Deadline**: All signatures expire after the specified deadline
4. **Reentrancy**: Protected via ReentrancyGuardUpgradeable
5. **Two-Hop Transfer**: Tokens never remain in the contract
6. **Upgradeability**: TransparentUpgradeableProxy allows bug fixes without state migration

## Gas Optimization

- Uses Solmate's `SafeTransferLib` for gas-efficient transfers
- Minimal storage usage (all data in calldata)
- Single external call to Permit2
- Optimized with `via_ir` and high optimization runs

## License

MIT
