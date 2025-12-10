// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {TransparentUpgradeableProxy, ITransparentUpgradeableProxy} from "openzeppelin-contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "openzeppelin-contracts/proxy/transparent/ProxyAdmin.sol";
import {X402SettlementV1} from "../src/X402Settlement.sol";

/// @notice Deployment script for X402 Settlement contract
/// @dev Deploys the implementation, proxy admin, and transparent upgradeable proxy
///      Usage: forge script script/Deploy.s.sol:DeployScript --rpc-url <RPC_URL> --broadcast --verify
contract DeployScript is Script {
    /// @notice Deploys the X402Settlement contract with a transparent upgradeable proxy
    /// @dev The deployer becomes the initial proxy admin owner
    /// @return proxy The address of the deployed proxy contract
    /// @return implementation The address of the implementation contract
    /// @return proxyAdmin The address of the proxy admin contract
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

        console2.log("Deploying X402Settlement with deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the implementation contract
        X402SettlementV1 settlementImpl = new X402SettlementV1();
        implementation = address(settlementImpl);
        console2.log("Implementation deployed at:", implementation);

        // Deploy the proxy admin (OZ 5.x requires initial owner)
        ProxyAdmin admin = new ProxyAdmin(deployer);
        proxyAdmin = address(admin);
        console2.log("ProxyAdmin deployed at:", proxyAdmin);

        // Encode the initialize call
        bytes memory initData = abi.encodeWithSignature("initialize()");

        // Deploy the transparent upgradeable proxy
        TransparentUpgradeableProxy settlementProxy = new TransparentUpgradeableProxy(
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
        console2.log("========================\n");

        return (proxy, implementation, proxyAdmin);
    }
}

/// @notice Upgrade script for X402 Settlement contract
/// @dev Upgrades an existing proxy to a new implementation
///      Usage: forge script script/Deploy.s.sol:UpgradeScript --rpc-url <RPC_URL> --broadcast
contract UpgradeScript is Script {
    /// @notice Upgrades the X402Settlement proxy to a new implementation
    /// @dev Requires PROXY_ADDRESS and PROXY_ADMIN environment variables
    /// @return newImplementation The address of the new implementation contract
    function run() external returns (address newImplementation) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        address proxyAdminAddress = vm.envAddress("PROXY_ADMIN");

        console2.log("Upgrading X402Settlement at proxy:", proxyAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        X402SettlementV1 newImpl = new X402SettlementV1();
        newImplementation = address(newImpl);
        console2.log("New implementation deployed at:", newImplementation);

        // Upgrade the proxy (OZ 5.x uses upgradeAndCall with empty bytes for no call)
        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(proxyAddress),
            newImplementation,
            ""
        );

        vm.stopBroadcast();

        console2.log("\n=== Upgrade Complete ===");
        console2.log("Proxy:", proxyAddress);
        console2.log("New Implementation:", newImplementation);
        console2.log("=====================\n");

        return newImplementation;
    }
}
