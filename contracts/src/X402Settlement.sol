// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "openzeppelin-contracts-upgradeable/proxy/utils/Initializable.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";
import {SafeTransferLib} from "solmate/utils/SafeTransferLib.sol";
import {ERC20} from "solmate/tokens/ERC20.sol";
import {IX402Settlement} from "./interfaces/IX402Settlement.sol";

/// @title X402SettlementV1
/// @notice Settlement contract for x402 payments using Permit2
/// @dev This contract enables trust-minimized token transfers where the recipient
///      is cryptographically enforced via Permit2 witness signatures.
///
///      The contract follows the UniswapX reactor pattern for two-hop transfers:
///      1. Permit2 transfers tokens from payer to this contract (via witness signature)
///      2. Contract immediately transfers tokens to the enforced recipient
///
///      This ensures the facilitator cannot redirect funds to a different recipient,
///      as the recipient address is cryptographically bound to the signature.
///
///      IMPORTANT LIMITATIONS:
///      - Only works with standard ERC20 tokens (18 decimals or less)
///      - Does NOT work with fee-on-transfer tokens (would lose value)
///      - Does NOT work with rebasing tokens (would transfer incorrect amounts)
///      - Does NOT work with tokens with balance hooks or callbacks
///
///      UPGRADEABILITY:
///      - Uses TransparentUpgradeableProxy pattern for upgrades
///      - ProxyAdmin should be owned by a multisig (not a single EOA)
///      - All upgrades should go through a timelock (48+ hours)
contract X402SettlementV1 is IX402Settlement, Initializable {
    using SafeTransferLib for ERC20;

    /// @notice The canonical Permit2 contract address
    /// @dev This is the same address on all EVM chains
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    /// @notice EIP-712 type hash for the PaymentOrder struct
    /// @dev This must match the witness type string used in signatures:
    ///      "PaymentOrder witness)PaymentOrder(address token,uint256 amount,address recipient,bytes32 paymentId,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"
    bytes32 public constant PAYMENT_ORDER_TYPEHASH = keccak256(
        "PaymentOrder(address token,uint256 amount,address recipient,bytes32 paymentId,uint256 nonce,uint256 deadline)"
    );

    /// @notice The witness type string for EIP-712 signature verification
    /// @dev This defines the structure that Permit2 will use to verify the signature
    ///      CRITICAL: Must include TokenPermissions definition as per Permit2 spec
    string private constant WITNESS_TYPE_STRING =
        "PaymentOrder witness)PaymentOrder(address token,uint256 amount,address recipient,bytes32 paymentId,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)";

    // Reentrancy guard state (upgradeable-safe - initialized in initialize())
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;

    /// @dev Storage gap for future upgrades (48 slots reserved)
    /// This ensures that adding new storage variables in future versions
    /// won't cause storage collisions between proxy and implementation
    uint256[49] private __gap;

    /// @notice Reentrancy guard modifier
    modifier nonReentrant() {
        require(_status != ENTERED, "REENTRANCY");
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }

    /// @notice Initializes the contract
    /// @dev Uses initializer pattern instead of constructor for upgradeability
    function initialize() external initializer {
        _status = NOT_ENTERED;
    }

    /// @inheritdoc IX402Settlement
    function executePayment(
        PaymentOrder calldata order,
        address payer,
        bytes calldata signature
    ) external nonReentrant {
        // Validate inputs
        if (order.amount == 0) {
            revert InvalidAmount();
        }
        if (order.token == address(0)) {
            revert InvalidToken();
        }
        if (order.recipient == address(0)) {
            revert InvalidRecipient();
        }
        if (payer == address(0)) {
            revert InvalidPayer();
        }

        // Validate deadline
        if (block.timestamp > order.deadline) {
            revert PaymentExpired(order.deadline);
        }

        // Compute the witness hash from the payment order
        bytes32 witness = keccak256(
            abi.encode(
                PAYMENT_ORDER_TYPEHASH,
                order.token,
                order.amount,
                order.recipient,
                order.paymentId,
                order.nonce,
                order.deadline
            )
        );

        // Prepare Permit2 transfer request
        // The payer must have approved Permit2 to spend their tokens
        ISignatureTransfer.PermitTransferFrom memory permit = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: order.token,
                amount: order.amount
            }),
            nonce: order.nonce,
            deadline: order.deadline
        });

        // Transfer tokens from payer to this contract via Permit2
        // The witness ensures that the order details (including recipient) are
        // cryptographically bound to the signature
        ISignatureTransfer.SignatureTransferDetails memory transferDetails = ISignatureTransfer
            .SignatureTransferDetails({
                to: address(this),
                requestedAmount: order.amount
            });

        ISignatureTransfer(PERMIT2).permitWitnessTransferFrom(
            permit,
            transferDetails,
            payer,
            witness,
            WITNESS_TYPE_STRING,
            signature
        );

        // Immediately transfer tokens from this contract to the recipient
        // This completes the two-hop transfer pattern
        ERC20(order.token).safeTransfer(order.recipient, order.amount);

        // Emit event for payment tracking (includes facilitator who submitted tx)
        emit PaymentExecuted(
            order.paymentId,
            payer,
            order.recipient,
            order.token,
            order.amount,
            msg.sender
        );
    }
}
