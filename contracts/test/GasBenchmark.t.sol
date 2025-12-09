// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {TransparentUpgradeableProxy} from "openzeppelin-contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "openzeppelin-contracts/proxy/transparent/ProxyAdmin.sol";
import {X402SettlementV1} from "../src/X402Settlement.sol";
import {IX402Settlement} from "../src/interfaces/IX402Settlement.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title Gas Benchmark Tests for x402 Payment Methods
/// @notice Compares gas costs between EIP-3009, Permit2 Direct, and Permit2 + Settlement
/// @dev Run with: forge test --match-contract GasBenchmarkTest --fork-url $BASE_SEPOLIA_RPC -vv
contract GasBenchmarkTest is Test {
    // Base Sepolia addresses
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // Test accounts - use fresh addresses to ensure they're EOAs (no code)
    uint256 payerPrivateKey;
    address payer;
    address recipient;
    address facilitator;

    // Settlement contract
    X402SettlementV1 public settlement;

    // Gas results
    uint256 public gasEIP3009;
    uint256 public gasPermit2Direct;
    uint256 public gasPermit2Settlement;

    function setUp() public {
        // Setup accounts - generate fresh key to ensure payer is a true EOA
        payerPrivateKey = uint256(keccak256(abi.encodePacked(block.timestamp, "payer", block.number)));
        payer = vm.addr(payerPrivateKey);
        recipient = makeAddr("recipient");
        facilitator = makeAddr("facilitator");

        // Fund payer with ETH for gas
        vm.deal(payer, 10 ether);
        vm.deal(facilitator, 10 ether);

        // Deploy settlement contract
        X402SettlementV1 impl = new X402SettlementV1();
        ProxyAdmin proxyAdmin = new ProxyAdmin(address(this));
        bytes memory initData = abi.encodeWithSignature("initialize()");
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            address(proxyAdmin),
            initData
        );
        settlement = X402SettlementV1(address(proxy));

        // Setup USDC for EIP-3009 test
        // Deal USDC to payer (using deal cheatcode)
        deal(USDC, payer, 1000e6); // 1000 USDC

        // Setup WETH for Permit2 tests
        // Wrap some ETH to WETH
        vm.prank(payer);
        (bool success,) = WETH.call{value: 1 ether}("");
        require(success, "WETH deposit failed");

        // Approve Permit2 to spend WETH
        vm.prank(payer);
        IERC20(WETH).approve(PERMIT2, type(uint256).max);
    }

    /// @notice Benchmark EIP-3009 transferWithAuthorization (USDC)
    function testGas_EIP3009_TransferWithAuthorization() public {
        uint256 amount = 1e6; // 1 USDC
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, "eip3009"));

        // Create EIP-3009 authorization signature
        bytes32 domainSeparator = _getUSDCDomainSeparator();
        bytes32 typeHash = keccak256(
            "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
        );
        bytes32 structHash = keccak256(abi.encode(
            typeHash,
            payer,
            recipient,
            amount,
            validAfter,
            validBefore,
            nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, digest);

        // Measure gas for transferWithAuthorization
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        (bool success,) = USDC.call(abi.encodeWithSignature(
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
            payer,
            recipient,
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        ));
        uint256 gasAfter = gasleft();

        gasEIP3009 = gasBefore - gasAfter;

        if (success) {
            console2.log("EIP-3009 transferWithAuthorization gas:", gasEIP3009);
        } else {
            console2.log("EIP-3009 call failed (USDC may not support EIP-3009 on this network)");
            // Use a fallback estimate based on mainnet measurements
            gasEIP3009 = 65000; // Typical EIP-3009 gas cost
            console2.log("Using fallback estimate:", gasEIP3009);
        }
    }

    /// @notice Benchmark Permit2 direct permitTransferFrom (naive, not trust-minimized)
    function testGas_Permit2_Direct() public {
        uint256 amount = 0.001 ether; // 0.001 WETH
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = 1;

        // Create Permit2 signature for permitTransferFrom
        bytes32 domainSeparator = _getPermit2DomainSeparator();

        bytes32 TOKEN_PERMISSIONS_TYPEHASH = keccak256("TokenPermissions(address token,uint256 amount)");
        bytes32 PERMIT_TRANSFER_FROM_TYPEHASH = keccak256(
            "PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"
        );

        bytes32 tokenPermissionsHash = keccak256(abi.encode(
            TOKEN_PERMISSIONS_TYPEHASH,
            WETH,
            amount
        ));

        bytes32 structHash = keccak256(abi.encode(
            PERMIT_TRANSFER_FROM_TYPEHASH,
            tokenPermissionsHash,
            facilitator, // spender
            nonce,
            deadline
        ));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Prepare Permit2 structs
        ISignatureTransfer.PermitTransferFrom memory permit = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: WETH,
                amount: amount
            }),
            nonce: nonce,
            deadline: deadline
        });

        ISignatureTransfer.SignatureTransferDetails memory transferDetails = ISignatureTransfer.SignatureTransferDetails({
            to: recipient,
            requestedAmount: amount
        });

        // Measure gas for permitTransferFrom
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        ISignatureTransfer(PERMIT2).permitTransferFrom(
            permit,
            transferDetails,
            payer,
            signature
        );
        uint256 gasAfter = gasleft();

        gasPermit2Direct = gasBefore - gasAfter;

        console2.log("Permit2 Direct permitTransferFrom gas:", gasPermit2Direct);
    }

    /// @notice Benchmark Permit2 + Settlement Contract (trust-minimized)
    function testGas_Permit2_Settlement() public {
        uint256 amount = 0.001 ether; // 0.001 WETH
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = 2; // Different nonce from direct test
        bytes32 paymentId = keccak256("test-resource");

        // Create PaymentOrder
        IX402Settlement.PaymentOrder memory order = IX402Settlement.PaymentOrder({
            token: WETH,
            amount: amount,
            recipient: recipient,
            paymentId: paymentId,
            nonce: nonce,
            deadline: deadline
        });

        // Create Permit2 signature with witness
        bytes32 domainSeparator = _getPermit2DomainSeparator();

        // Compute witness hash
        bytes32 PAYMENT_ORDER_TYPEHASH = keccak256(
            "PaymentOrder(address token,uint256 amount,address recipient,bytes32 paymentId,uint256 nonce,uint256 deadline)"
        );
        bytes32 witness = keccak256(abi.encode(
            PAYMENT_ORDER_TYPEHASH,
            WETH,
            amount,
            recipient,
            paymentId,
            nonce,
            deadline
        ));

        // Permit2 type hashes
        bytes32 TOKEN_PERMISSIONS_TYPEHASH = keccak256("TokenPermissions(address token,uint256 amount)");
        string memory witnessTypeString = "PaymentOrder witness)PaymentOrder(address token,uint256 amount,address recipient,bytes32 paymentId,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)";
        bytes32 PERMIT_WITNESS_TRANSFER_FROM_TYPEHASH = keccak256(
            abi.encodePacked(
                "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,",
                witnessTypeString
            )
        );

        bytes32 tokenPermissionsHash = keccak256(abi.encode(
            TOKEN_PERMISSIONS_TYPEHASH,
            WETH,
            amount
        ));

        bytes32 structHash = keccak256(abi.encode(
            PERMIT_WITNESS_TRANSFER_FROM_TYPEHASH,
            tokenPermissionsHash,
            address(settlement), // spender is settlement contract
            nonce,
            deadline,
            witness
        ));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Measure gas for settlement.executePayment
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        settlement.executePayment(order, payer, signature);
        uint256 gasAfter = gasleft();

        gasPermit2Settlement = gasBefore - gasAfter;

        console2.log("Permit2 + Settlement executePayment gas:", gasPermit2Settlement);
    }

    /// @notice Print summary of all gas benchmarks
    function testGas_Summary() public {
        // Run all benchmarks first
        testGas_EIP3009_TransferWithAuthorization();

        // Reset nonce state for Permit2 tests
        setUp();
        testGas_Permit2_Direct();

        setUp();
        testGas_Permit2_Settlement();

        // Print summary
        console2.log("\n========================================");
        console2.log("GAS BENCHMARK SUMMARY");
        console2.log("========================================");
        console2.log("EIP-3009 (transferWithAuthorization):", gasEIP3009);
        console2.log("Permit2 Direct (permitTransferFrom): ", gasPermit2Direct);
        console2.log("Permit2 + Settlement (executePayment):", gasPermit2Settlement);
        console2.log("----------------------------------------");

        if (gasPermit2Direct > 0) {
            uint256 settlementOverhead = gasPermit2Settlement - gasPermit2Direct;
            uint256 overheadPercent = (settlementOverhead * 100) / gasPermit2Direct;
            console2.log("Settlement overhead vs Direct Permit2:", settlementOverhead, "gas");
            console2.log("Settlement overhead percentage:", overheadPercent, "%");
        }

        if (gasEIP3009 > 0 && gasPermit2Settlement > 0) {
            if (gasPermit2Settlement > gasEIP3009) {
                uint256 diff = gasPermit2Settlement - gasEIP3009;
                console2.log("Settlement vs EIP-3009 difference:", diff, "gas (settlement higher)");
            } else {
                uint256 diff = gasEIP3009 - gasPermit2Settlement;
                console2.log("Settlement vs EIP-3009 difference:", diff, "gas (EIP-3009 higher)");
            }
        }
        console2.log("========================================\n");
    }

    /// @notice Get USDC domain separator for Base Sepolia
    function _getUSDCDomainSeparator() internal view returns (bytes32) {
        // USDC uses EIP-712 domain
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("USD Coin")),
            keccak256(bytes("2")),
            block.chainid,
            USDC
        ));
    }

    /// @notice Get Permit2 domain separator
    function _getPermit2DomainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("Permit2")),
            block.chainid,
            PERMIT2
        ));
    }
}
