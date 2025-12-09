// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title IX402Settlement
/// @notice Interface for the X402 Settlement contract
/// @dev Enables trust-minimized Permit2 transfers for x402 payments
interface IX402Settlement {
    /// @notice The payment order structure that must be signed by the payer
    /// @dev This struct is used as the witness data in Permit2 signatures
    struct PaymentOrder {
        /// @notice The token address to transfer
        address token;
        /// @notice The amount of tokens to transfer
        uint256 amount;
        /// @notice The recipient address that will receive the tokens
        /// @dev This is cryptographically enforced via the Permit2 witness signature
        address recipient;
        /// @notice A unique identifier binding this payment to a specific resource
        bytes32 paymentId;
        /// @notice A unique nonce to prevent signature replay attacks
        uint256 nonce;
        /// @notice The deadline timestamp after which the signature expires
        uint256 deadline;
    }

    /// @notice Emitted when a payment is successfully executed
    /// @param paymentId The unique payment identifier
    /// @param payer The address that authorized the payment
    /// @param recipient The address that received the payment
    /// @param token The token address that was transferred
    /// @param amount The amount of tokens transferred
    /// @param facilitator The address that submitted the transaction
    event PaymentExecuted(
        bytes32 indexed paymentId,
        address indexed payer,
        address indexed recipient,
        address token,
        uint256 amount,
        address facilitator
    );

    /// @notice Error thrown when a payment order has expired
    /// @param deadline The deadline timestamp that was exceeded
    error PaymentExpired(uint256 deadline);

    /// @notice Error thrown when signature verification fails
    error InvalidSignature();

    /// @notice Error thrown when a nonce has already been used
    error NonceAlreadyUsed();

    /// @notice Executes a payment using a Permit2 signature
    /// @dev This function uses permitWitnessTransferFrom to ensure the recipient
    ///      is cryptographically bound to the signature
    /// @param order The payment order details
    /// @param payer The address that signed the payment authorization
    /// @param signature The Permit2 signature from the payer
    function executePayment(
        PaymentOrder calldata order,
        address payer,
        bytes calldata signature
    ) external;

    /// @notice Returns the EIP-712 type hash for PaymentOrder
    /// @return The keccak256 hash of the PaymentOrder type string
    function PAYMENT_ORDER_TYPEHASH() external pure returns (bytes32);

    /// @notice Returns the Permit2 contract address
    /// @return The address of the Permit2 contract
    function PERMIT2() external view returns (address);
}
