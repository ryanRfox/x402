# X402 Settlement Contract - Implementation Summary

## Overview

The X402 Settlement Contract is a Foundry-based Solidity implementation that enables trust-minimized Permit2 transfers for the x402 payment protocol. The contract follows the UniswapX reactor pattern and uses OpenZeppelin's TransparentUpgradeableProxy for upgradeability.

## Architecture

### Core Components

1. **X402SettlementV1** (`src/X402Settlement.sol`)
   - Main implementation contract
   - Handles payment execution via Permit2
   - Uses two-hop transfer pattern for security
   - Upgradeable via proxy pattern

2. **IX402Settlement** (`src/interfaces/IX402Settlement.sol`)
   - Interface definition
   - PaymentOrder struct specification
   - Event and error definitions

3. **Deployment Scripts** (`script/Deploy.s.sol`)
   - Initial deployment with proxy
   - Upgrade functionality
   - Both scripts included

4. **Test Suite** (`test/X402Settlement.t.sol`)
   - Comprehensive test coverage
   - Mock contracts for isolated testing
   - 10+ test cases covering all scenarios

## Payment Flow

```
┌─────────┐                ┌─────────┐                ┌────────────┐                ┌───────────┐
│  Payer  │───(1)───────>  │ Permit2 │───(2)───────>  │ Settlement │───(3)───────>  │ Recipient │
│         │  Sign Order    │         │  Transfer      │  Contract  │  Forward       │           │
└─────────┘                └─────────┘                └────────────┘                └───────────┘
     │                                                       │
     │                                                       │
     └───────────────────(4)───────────────────────────────┘
                    Event: PaymentExecuted
```

### Steps:

1. **Sign**: Payer signs a PaymentOrder with Permit2 witness
2. **Transfer to Contract**: Permit2 transfers tokens from payer to settlement contract
3. **Forward to Recipient**: Contract immediately forwards tokens to recipient
4. **Event**: PaymentExecuted event emitted for tracking

## Key Features

### Security

- **Cryptographic Recipient Enforcement**: Recipient address is bound via Permit2 witness signature
- **Replay Protection**: Unordered nonces prevent signature reuse
- **Deadline Expiry**: All signatures have expiration timestamps
- **Reentrancy Guard**: Protected against reentrancy attacks
- **Two-Hop Transfer**: Tokens never remain in contract (flash-transfer pattern)

### Gas Optimization

- **Solmate SafeTransferLib**: Gas-efficient token transfers
- **Minimal Storage**: All data passed via calldata
- **Single Permit2 Call**: One external call per payment
- **Compiler Optimization**: `via_ir` with 1M optimizer runs

### Upgradeability

- **TransparentUpgradeableProxy**: Industry-standard upgrade pattern
- **Separate ProxyAdmin**: Admin functions isolated from proxy
- **Initializer Pattern**: No constructor state for clean upgrades

## PaymentOrder Structure

```solidity
struct PaymentOrder {
    address token;       // ERC20 token address
    uint256 amount;      // Transfer amount
    address recipient;   // Cryptographically enforced recipient
    bytes32 paymentId;   // Unique identifier (e.g., resource hash)
    uint256 nonce;       // Replay protection
    uint256 deadline;    // Signature expiry timestamp
}
```

## EIP-712 Signature

### Type Hash

```solidity
keccak256("PaymentOrder(address token,uint256 amount,address recipient,bytes32 paymentId,uint256 nonce,uint256 deadline)")
```

### Witness Type String

```
PaymentOrder witness)PaymentOrder(address token,uint256 amount,address recipient,bytes32 paymentId,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)
```

**Note**: The `TokenPermissions` definition is required by Permit2 specification.

## Contract Interface

### Main Function

```solidity
function executePayment(
    PaymentOrder calldata order,
    address payer,
    bytes calldata signature
) external;
```

### Events

```solidity
event PaymentExecuted(
    bytes32 indexed paymentId,
    address indexed payer,
    address indexed recipient,
    address token,
    uint256 amount
);
```

### Errors

```solidity
error PaymentExpired(uint256 deadline);
error InvalidSignature();
error NonceAlreadyUsed();
```

## Dependencies

All dependencies installed via Foundry:

| Package | Source | Purpose |
|---------|--------|---------|
| forge-std | foundry-rs/forge-std | Testing framework |
| permit2 | Uniswap/permit2 | Signature transfer protocol |
| openzeppelin-contracts | OpenZeppelin/openzeppelin-contracts | Proxy contracts |
| openzeppelin-contracts-upgradeable | OpenZeppelin/openzeppelin-contracts-upgradeable | Upgradeable patterns |
| solmate | transmissions11/solmate | Gas-efficient utilities |

## Installation

See [INSTALL.md](./INSTALL.md) for detailed installation instructions.

Quick start:
```bash
make install  # Install dependencies
make build    # Compile contracts
make test     # Run test suite
```

## Deployment

### Using Make

```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://sepolia.base.org

make deploy         # Deploy without verification
make deploy-verify  # Deploy with Etherscan verification
```

### Using Forge Script

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

### Output

The deployment script outputs:
- **Proxy Address**: Use this for all interactions
- **Implementation Address**: The logic contract
- **ProxyAdmin Address**: For upgrades

## Testing

### Run All Tests

```bash
forge test
```

### Run with Verbosity

```bash
forge test -vvv
```

### Gas Report

```bash
forge test --gas-report
```

### Test Coverage

- ✅ Successful payment execution
- ✅ Deadline expiry validation
- ✅ Nonce reuse prevention
- ✅ Recipient enforcement via witness
- ✅ Event emission
- ✅ Multiple sequential payments
- ✅ Different payment amounts (fuzz testing)
- ✅ Reentrancy protection
- ✅ Initialization checks
- ✅ Constants verification

## Permit2 Integration

### Canonical Permit2 Address

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

This address is the same on all EVM chains.

### Prerequisites

Before using the settlement contract, payers must:

1. **Approve Permit2** (one-time per token):
```solidity
IERC20(token).approve(PERMIT2, type(uint256).max);
```

2. **Have Token Balance**: Sufficient tokens in their wallet

### Signature Creation

Example using ethers.js (TypeScript):

```typescript
const domain = {
  name: 'Permit2',
  chainId: 84532, // Base Sepolia
  verifyingContract: PERMIT2_ADDRESS
};

const types = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ],
  PaymentOrder: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'paymentId', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
};

const value = {
  permitted: {
    token: WETH_ADDRESS,
    amount: AMOUNT
  },
  spender: SETTLEMENT_CONTRACT,
  nonce: NONCE,
  deadline: DEADLINE,
  witness: order // PaymentOrder struct
};

const signature = await signer._signTypedData(domain, types, value);
```

## Network Configuration

### Base Sepolia

- **RPC**: https://sepolia.base.org
- **Chain ID**: 84532
- **WETH**: 0x4200000000000000000000000000000000000006
- **Permit2**: 0x000000000022D473030F116dDEE9F6B43aC78BA3

### Ethereum Sepolia

- **RPC**: https://rpc.sepolia.org
- **Chain ID**: 11155111
- **WETH**: 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
- **Permit2**: 0x000000000022D473030F116dDEE9F6B43aC78BA3

## Upgrade Process

1. **Deploy New Implementation**:
```bash
export PROXY_ADDRESS=0x...
export PROXY_ADMIN=0x...
make upgrade
```

2. **Verify State Preservation**:
   - All previous payments remain valid
   - Nonce bitmap preserved
   - No storage layout changes

## Security Audit Recommendations

Before mainnet deployment:

1. ✅ Professional security audit (Recommended: Trail of Bits, OpenZeppelin, Consensys Diligence)
2. ✅ Formal verification of core invariants
3. ✅ Testnet deployment with real usage (minimum 1 week)
4. ✅ Bug bounty program
5. ✅ Multi-sig for proxy admin ownership

## Gas Costs (Estimated)

| Operation | Gas Cost |
|-----------|----------|
| Deploy Implementation | ~1.2M |
| Deploy Proxy | ~400K |
| First Payment | ~150K |
| Subsequent Payments | ~120K |

*Note: Actual costs depend on network and token implementation*

## Future Enhancements

Potential v2 features:

1. **Batch Payments**: Execute multiple payments in one transaction
2. **Partial Fills**: Allow payments less than full amount
3. **Multi-Token**: Support multiple tokens in one payment
4. **Relayer Support**: Gas abstraction via relayers
5. **Payment Cancellation**: Cancel pending payments before deadline

## Project Structure

```
contracts/
├── foundry.toml                   # Foundry configuration
├── remappings.txt                 # Import path mappings
├── .gitignore                     # Git ignore rules
├── .env.example                   # Environment template
├── README.md                      # User documentation
├── INSTALL.md                     # Installation guide
├── IMPLEMENTATION.md              # This file
├── Makefile                       # Build automation
├── install.sh                     # Installation script
├── src/
│   ├── X402Settlement.sol         # Main implementation
│   └── interfaces/
│       └── IX402Settlement.sol    # Interface definition
├── script/
│   └── Deploy.s.sol               # Deployment scripts
├── test/
│   └── X402Settlement.t.sol       # Test suite
└── lib/                           # Dependencies (git submodules)
    ├── forge-std/
    ├── permit2/
    ├── openzeppelin-contracts/
    ├── openzeppelin-contracts-upgradeable/
    └── solmate/
```

## Integration with x402 SDK

The settlement contract is designed to integrate with the x402 TypeScript SDK:

### Server Configuration

```typescript
app.use(paymentMiddleware({
  "GET /protected-permit2": {
    accepts: {
      payTo: SERVER_ADDRESS,
      scheme: "exact",
      network: "eip155:84532",
      price: {
        amount: "1000000000000000", // 0.001 WETH
        asset: WETH_ADDRESS,
        extra: {
          assetTransferMethod: "permit2",
          settlementContract: SETTLEMENT_PROXY_ADDRESS
        }
      }
    }
  }
}));
```

### Client Usage

The SDK automatically handles:
1. Payment order creation
2. EIP-712 signature generation
3. Permit2 approval verification
4. Transaction submission

## License

MIT License - See [LICENSE](../LICENSE) for details

## Support

For issues or questions:
- GitHub Issues: https://github.com/anthropics/x402/issues
- Documentation: https://github.com/anthropics/x402/tree/main/docs

## Acknowledgments

- **Uniswap Labs**: Permit2 protocol design
- **OpenZeppelin**: Upgradeable proxy patterns
- **Foundry**: Development framework
- **Solmate**: Gas-optimized libraries
