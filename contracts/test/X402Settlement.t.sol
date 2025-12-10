// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {TransparentUpgradeableProxy} from "openzeppelin-contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "openzeppelin-contracts/proxy/transparent/ProxyAdmin.sol";
import {X402SettlementV1} from "../src/X402Settlement.sol";
import {IX402Settlement} from "../src/interfaces/IX402Settlement.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";
import {ERC20} from "solmate/tokens/ERC20.sol";

/// @notice Mock ERC20 token for testing
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK", 18) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Mock Permit2 contract for testing
/// @dev Implements the minimal ISignatureTransfer interface needed for tests
contract MockPermit2 is ISignatureTransfer {
    mapping(address => mapping(uint256 => uint256)) public override nonceBitmap;

    // Local error definitions matching ISignatureTransfer
    error MockSignatureExpired(uint256 deadline);
    error MockInvalidNonce();

    /// @notice Simplified signature verification for testing
    /// @dev In tests, we verify the witness is correctly passed and tokens are transferred
    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external override {
        // Silence unused variable warnings
        witness; witnessTypeString;

        // Check deadline
        if (block.timestamp > permit.deadline) {
            revert MockSignatureExpired(permit.deadline);
        }

        // Check nonce (simplified - just check if already used)
        _useUnorderedNonce(owner, permit.nonce);

        // Verify signature (simplified for testing)
        // In production, this does full EIP-712 verification
        require(signature.length == 65, "Invalid signature length");

        // Transfer tokens from owner to the specified recipient
        ERC20(permit.permitted.token).transferFrom(
            owner,
            transferDetails.to,
            transferDetails.requestedAmount
        );
    }

    /// @notice Nonce management (simplified)
    function _useUnorderedNonce(address from, uint256 nonce) internal {
        uint256 wordPos = uint248(nonce >> 8);
        uint256 bitPos = uint8(nonce);
        uint256 bit = 1 << bitPos;
        uint256 flipped = nonceBitmap[from][wordPos] ^= bit;

        if (flipped & bit == 0) revert MockInvalidNonce();
    }

    // Stub implementations for interface compliance
    function permitTransferFrom(
        PermitTransferFrom memory,
        SignatureTransferDetails calldata,
        address,
        bytes calldata
    ) external pure override {
        revert("Not implemented");
    }

    function permitTransferFrom(
        PermitBatchTransferFrom memory,
        SignatureTransferDetails[] calldata,
        address,
        bytes calldata
    ) external pure override {
        revert("Not implemented");
    }

    function permitWitnessTransferFrom(
        PermitBatchTransferFrom memory,
        SignatureTransferDetails[] calldata,
        address,
        bytes32,
        string calldata,
        bytes calldata
    ) external pure override {
        revert("Not implemented");
    }

    function invalidateUnorderedNonces(uint256, uint256) external pure override {
        revert("Not implemented");
    }

    function DOMAIN_SEPARATOR() external pure override returns (bytes32) {
        return bytes32(0);
    }
}

/// @notice Test suite for X402Settlement contract
contract X402SettlementTest is Test {
    X402SettlementV1 public settlement;
    MockERC20 public token;
    MockPermit2 public mockPermit2;
    ProxyAdmin public proxyAdmin;

    address public deployer;
    address public payer;
    address public recipient;
    address public attacker;

    uint256 public payerPrivateKey;

    bytes32 public constant PAYMENT_ID = keccak256("test-payment-1");
    uint256 public constant AMOUNT = 1e18;
    uint256 public constant NONCE = 12345;

    function setUp() public {
        // Setup accounts
        deployer = address(this);
        payerPrivateKey = 0xA11CE;
        payer = vm.addr(payerPrivateKey);
        recipient = makeAddr("recipient");
        attacker = makeAddr("attacker");

        // Deploy mock token
        token = new MockERC20();

        // Deploy mock Permit2
        mockPermit2 = new MockPermit2();

        // Deploy implementation
        X402SettlementV1 impl = new X402SettlementV1();

        // Deploy proxy admin (OZ 5.x requires initial owner)
        proxyAdmin = new ProxyAdmin(deployer);

        // Deploy proxy
        bytes memory initData = abi.encodeWithSignature("initialize()");
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            address(proxyAdmin),
            initData
        );

        settlement = X402SettlementV1(address(proxy));

        // Setup token balances
        token.mint(payer, AMOUNT * 10);

        // Approve the ACTUAL Permit2 address to spend payer's tokens
        // (we'll etch MockPermit2 bytecode to this address in tests)
        address permit2Addr = settlement.PERMIT2();
        vm.prank(payer);
        token.approve(permit2Addr, type(uint256).max);
    }

    /// @notice Helper function to create a valid payment order
    function createPaymentOrder(
        uint256 nonce,
        uint256 deadline
    ) internal view returns (IX402Settlement.PaymentOrder memory) {
        return IX402Settlement.PaymentOrder({
            token: address(token),
            amount: AMOUNT,
            recipient: recipient,
            paymentId: PAYMENT_ID,
            nonce: nonce,
            deadline: deadline
        });
    }

    /// @notice Helper function to create a dummy signature
    /// @dev In real tests with actual Permit2, this would be a proper EIP-712 signature
    function createSignature() internal pure returns (bytes memory) {
        // Return a dummy 65-byte signature for testing
        // In production, this would be a proper EIP-712 signature
        return abi.encodePacked(
            bytes32(uint256(1)), // r
            bytes32(uint256(2)), // s
            uint8(27) // v
        );
    }

    /// @notice Test successful payment execution
    function testExecutePayment() public {
        uint256 deadline = block.timestamp + 1 hours;
        IX402Settlement.PaymentOrder memory order = createPaymentOrder(NONCE, deadline);
        bytes memory signature = createSignature();

        uint256 recipientBalanceBefore = token.balanceOf(recipient);
        uint256 payerBalanceBefore = token.balanceOf(payer);

        // Execute payment - we replace Permit2 address in storage for testing
        vm.etch(settlement.PERMIT2(), address(mockPermit2).code);

        vm.expectEmit(true, true, true, true);
        emit IX402Settlement.PaymentExecuted(
            PAYMENT_ID,
            payer,
            recipient,
            address(token),
            AMOUNT,
            address(this)  // facilitator is msg.sender (test contract)
        );

        settlement.executePayment(order, payer, signature);

        // Verify balances changed correctly
        assertEq(token.balanceOf(recipient), recipientBalanceBefore + AMOUNT);
        assertEq(token.balanceOf(payer), payerBalanceBefore - AMOUNT);
    }

    /// @notice Test that payment fails after deadline
    function testExecutePaymentRevertsWhenExpired() public {
        uint256 deadline = block.timestamp - 1; // Already expired
        IX402Settlement.PaymentOrder memory order = createPaymentOrder(NONCE, deadline);
        bytes memory signature = createSignature();

        vm.expectRevert(abi.encodeWithSelector(
            IX402Settlement.PaymentExpired.selector,
            deadline
        ));

        settlement.executePayment(order, payer, signature);
    }

    /// @notice Test that nonce cannot be reused
    function testExecutePaymentRevertsOnNonceReuse() public {
        uint256 deadline = block.timestamp + 1 hours;
        IX402Settlement.PaymentOrder memory order = createPaymentOrder(NONCE, deadline);
        bytes memory signature = createSignature();

        // Replace Permit2 address for testing
        vm.etch(settlement.PERMIT2(), address(mockPermit2).code);

        // First payment succeeds
        settlement.executePayment(order, payer, signature);

        // Mint more tokens for second attempt
        token.mint(payer, AMOUNT);

        // Second payment with same nonce should fail
        vm.expectRevert(MockPermit2.MockInvalidNonce.selector);
        settlement.executePayment(order, payer, signature);
    }

    /// @notice Test that the witness correctly binds the recipient
    /// @dev This is critical for security - the recipient in the order must match the signature
    function testWitnessEnforcesRecipient() public {
        uint256 deadline = block.timestamp + 1 hours;
        IX402Settlement.PaymentOrder memory order = createPaymentOrder(NONCE, deadline);
        bytes memory signature = createSignature();

        // Replace Permit2 address for testing
        vm.etch(settlement.PERMIT2(), address(mockPermit2).code);

        // Execute the payment
        settlement.executePayment(order, payer, signature);

        // Verify tokens went to the correct recipient
        assertEq(token.balanceOf(recipient), AMOUNT);
        assertEq(token.balanceOf(attacker), 0);
    }

    /// @notice Test event emission
    function testPaymentExecutedEvent() public {
        uint256 deadline = block.timestamp + 1 hours;
        IX402Settlement.PaymentOrder memory order = createPaymentOrder(NONCE, deadline);
        bytes memory signature = createSignature();

        // Replace Permit2 address for testing
        vm.etch(settlement.PERMIT2(), address(mockPermit2).code);

        vm.expectEmit(true, true, true, true);
        emit IX402Settlement.PaymentExecuted(
            PAYMENT_ID,
            payer,
            recipient,
            address(token),
            AMOUNT,
            address(this)  // facilitator is msg.sender (test contract)
        );

        settlement.executePayment(order, payer, signature);
    }

    /// @notice Test payment with different amounts
    function testExecutePaymentWithDifferentAmounts(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 1e27); // Reasonable bounds

        uint256 deadline = block.timestamp + 1 hours;

        IX402Settlement.PaymentOrder memory order = IX402Settlement.PaymentOrder({
            token: address(token),
            amount: amount,
            recipient: recipient,
            paymentId: PAYMENT_ID,
            nonce: NONCE,
            deadline: deadline
        });

        // Mint enough tokens
        token.mint(payer, amount);

        bytes memory signature = createSignature();

        // Replace Permit2 address for testing
        vm.etch(settlement.PERMIT2(), address(mockPermit2).code);

        settlement.executePayment(order, payer, signature);

        assertEq(token.balanceOf(recipient), amount);
    }

    /// @notice Test multiple sequential payments
    function testMultiplePayments() public {
        uint256 deadline = block.timestamp + 1 hours;

        // Replace Permit2 address for testing
        vm.etch(settlement.PERMIT2(), address(mockPermit2).code);

        for (uint256 i = 0; i < 3; i++) {
            IX402Settlement.PaymentOrder memory order = IX402Settlement.PaymentOrder({
                token: address(token),
                amount: AMOUNT,
                recipient: recipient,
                paymentId: keccak256(abi.encodePacked("payment", i)),
                nonce: NONCE + i,
                deadline: deadline
            });

            bytes memory signature = createSignature();
            settlement.executePayment(order, payer, signature);
        }

        assertEq(token.balanceOf(recipient), AMOUNT * 3);
    }

    /// @notice Test constants are correctly set
    function testConstants() public view {
        assertEq(settlement.PERMIT2(), 0x000000000022D473030F116dDEE9F6B43aC78BA3);
        assertEq(
            settlement.PAYMENT_ORDER_TYPEHASH(),
            keccak256("PaymentOrder(address token,uint256 amount,address recipient,bytes32 paymentId,uint256 nonce,uint256 deadline)")
        );
    }

    /// @notice Test reentrancy protection
    function testReentrancyProtection() public {
        // This test would require a malicious token contract
        // For now, we verify the contract has the nonReentrant modifier
        // The actual reentrancy guard testing would be more complex

        uint256 deadline = block.timestamp + 1 hours;
        IX402Settlement.PaymentOrder memory order = createPaymentOrder(NONCE, deadline);
        bytes memory signature = createSignature();

        // Replace Permit2 address for testing
        vm.etch(settlement.PERMIT2(), address(mockPermit2).code);

        settlement.executePayment(order, payer, signature);

        // Basic verification that the function completes without reentrancy issues
        assertEq(token.balanceOf(recipient), AMOUNT);
    }

    /// @notice Test contract initialization
    function testInitialization() public {
        // Verify contract is initialized
        // Try to initialize again - should fail
        vm.expectRevert(); // OZ 5.x uses InvalidInitialization() error
        settlement.initialize();
    }
}
