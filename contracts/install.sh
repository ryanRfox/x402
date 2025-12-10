#!/bin/bash

# X402 Settlement Contract - Dependency Installation Script

set -e

echo "Installing Foundry dependencies for X402 Settlement Contract..."

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo "Error: forge not found. Please install Foundry first:"
    echo "  curl -L https://foundry.paradigm.xyz | bash"
    echo "  foundryup"
    exit 1
fi

cd "$(dirname "$0")"

# Install dependencies
echo "Installing forge-std..."
forge install foundry-rs/forge-std --no-commit

echo "Installing permit2..."
forge install Uniswap/permit2 --no-commit

echo "Installing openzeppelin-contracts..."
forge install OpenZeppelin/openzeppelin-contracts --no-commit

echo "Installing openzeppelin-contracts-upgradeable..."
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit

echo "Installing solmate..."
forge install transmissions11/solmate --no-commit

echo ""
echo "Building contracts..."
forge build

echo ""
echo "Running tests..."
forge test

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Set environment variables for deployment"
echo "  2. Deploy to testnet: forge script script/Deploy.s.sol:DeployScript --rpc-url <RPC> --broadcast"
echo ""
