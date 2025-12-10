.PHONY: install build test clean deploy deploy-verify test-gas help

# Default target
help:
	@echo "X402 Settlement Contract - Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  make install       - Install Foundry dependencies"
	@echo "  make build         - Compile contracts"
	@echo "  make test          - Run test suite"
	@echo "  make test-gas      - Run tests with gas reporting"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make deploy        - Deploy to testnet (requires env vars)"
	@echo "  make deploy-verify - Deploy and verify on Etherscan"
	@echo ""

# Install dependencies
install:
	forge install foundry-rs/forge-std --no-commit
	forge install Uniswap/permit2 --no-commit
	forge install OpenZeppelin/openzeppelin-contracts --no-commit
	forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit
	forge install transmissions11/solmate --no-commit

# Build contracts
build:
	forge build

# Run tests
test:
	forge test

# Run tests with gas reporting
test-gas:
	forge test --gas-report

# Clean build artifacts
clean:
	forge clean
	rm -rf cache out

# Deploy to testnet
deploy:
	@echo "Deploying X402Settlement..."
	@if [ -z "$$PRIVATE_KEY" ]; then echo "Error: PRIVATE_KEY not set"; exit 1; fi
	@if [ -z "$$RPC_URL" ]; then echo "Error: RPC_URL not set"; exit 1; fi
	forge script script/Deploy.s.sol:DeployScript --rpc-url $$RPC_URL --broadcast

# Deploy and verify
deploy-verify:
	@echo "Deploying and verifying X402Settlement..."
	@if [ -z "$$PRIVATE_KEY" ]; then echo "Error: PRIVATE_KEY not set"; exit 1; fi
	@if [ -z "$$RPC_URL" ]; then echo "Error: RPC_URL not set"; exit 1; fi
	forge script script/Deploy.s.sol:DeployScript --rpc-url $$RPC_URL --broadcast --verify

# Upgrade existing deployment
upgrade:
	@echo "Upgrading X402Settlement..."
	@if [ -z "$$PRIVATE_KEY" ]; then echo "Error: PRIVATE_KEY not set"; exit 1; fi
	@if [ -z "$$RPC_URL" ]; then echo "Error: RPC_URL not set"; exit 1; fi
	@if [ -z "$$PROXY_ADDRESS" ]; then echo "Error: PROXY_ADDRESS not set"; exit 1; fi
	@if [ -z "$$PROXY_ADMIN" ]; then echo "Error: PROXY_ADMIN not set"; exit 1; fi
	forge script script/Deploy.s.sol:UpgradeScript --rpc-url $$RPC_URL --broadcast
