// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {TransparentUpgradeableProxy} from "openzeppelin-contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "openzeppelin-contracts/proxy/transparent/ProxyAdmin.sol";
import {X402SettlementV1} from "../src/X402Settlement.sol";

/// @notice CREATE2 Deployment script for X402 Settlement contract
/// @dev Uses CREATE2 for deterministic addresses across chains
///      Usage: forge script script/DeployCreate2.s.sol:DeployCreate2Script --rpc-url base_sepolia --broadcast --verify
contract DeployCreate2Script is Script {
    // CREATE2 salt for deterministic deployment
    // Using a memorable salt that includes the project name
    bytes32 public constant SALT = keccak256("x402-settlement-v1");

    /// @notice Deploys the X402Settlement contract with CREATE2
    /// @dev The deployer becomes the initial proxy admin owner
    function run()
        external
        returns (
            address proxy,
            address implementation,
            address proxyAdmin
        )
    {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=== CREATE2 Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("Salt:", vm.toString(SALT));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the implementation contract with CREATE2
        X402SettlementV1 settlementImpl = new X402SettlementV1{salt: SALT}();
        implementation = address(settlementImpl);
        console2.log("Implementation deployed at:", implementation);

        // Deploy the proxy admin with CREATE2
        // Salt is modified to ensure unique address
        ProxyAdmin admin = new ProxyAdmin{salt: keccak256(abi.encodePacked(SALT, "admin"))}(deployer);
        proxyAdmin = address(admin);
        console2.log("ProxyAdmin deployed at:", proxyAdmin);

        // Encode the initialize call
        bytes memory initData = abi.encodeWithSignature("initialize()");

        // Deploy the transparent upgradeable proxy with CREATE2
        // Salt is modified to ensure unique address
        TransparentUpgradeableProxy settlementProxy = new TransparentUpgradeableProxy{salt: keccak256(abi.encodePacked(SALT, "proxy"))}(
            implementation,
            proxyAdmin,
            initData
        );
        proxy = address(settlementProxy);
        console2.log("Proxy deployed at:", proxy);

        vm.stopBroadcast();

        console2.log("\n=== Deployment Summary ===");
        console2.log("Proxy (use this address):", proxy);
        console2.log("Implementation:", implementation);
        console2.log("ProxyAdmin:", proxyAdmin);
        console2.log("Owner:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("========================\n");

        return (proxy, implementation, proxyAdmin);
    }
}
