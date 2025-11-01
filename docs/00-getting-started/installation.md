# Installation & Setup

This guide walks you through setting up your development environment for x402.

---

## ⚠️ IMPORTANT: Packages Not Published to npm

**The x402 v2 SDK packages are NOT available on npm yet.** They exist only in this local repository.

❌ **This will NOT work**: `npm install @x402/fetch`

✅ **You must use local file paths**: `npm install file:/path/to/x402/typescript/packages/http/fetch`

**📖 See**: [Local Development Notice](./LOCAL_DEVELOPMENT_NOTICE.md) for complete installation instructions with `file:` paths.

---

## Table of Contents

- [System Requirements](#system-requirements)
- [Version Management with mise](#version-management-with-mise)
- [Installing the SDK](#installing-the-sdk)
- [Environment Configuration](#environment-configuration)
- [Wallet Setup](#wallet-setup)
- [Getting Testnet Funds](#getting-testnet-funds)
- [Verification](#verification)

---

## System Requirements

### Required
- **Node.js** >= 18.0.0 (we recommend 22.x)
- **Package manager**: pnpm 10.7.0 (recommended), npm, or yarn
- **Operating System**: macOS, Linux, or Windows (WSL2)

### Optional but Recommended
- **[mise](https://mise.jdx.dev/)** - Development tool version manager
- **Git** - For cloning examples and contributing

---

## Version Management with mise

We strongly recommend using [mise](https://mise.jdx.dev/) to manage tool versions. The x402 project includes a `.mise.toml` configuration that automatically sets up the correct versions.

### Installing mise

**macOS/Linux:**
```bash
curl https://mise.jdx.dev/install.sh | sh
```

**After installation, add to your shell:**
```bash
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc  # For bash
# or
echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc   # For zsh
```

**Restart your shell or source the config:**
```bash
source ~/.bashrc  # or ~/.zshrc
```

### Using mise in x402 Projects

When you clone the x402 repository or create a project with a `.mise.toml` file:

```bash
# Navigate to the project directory
cd your-x402-project

# Trust the mise configuration (first time only)
mise trust

# Install all required tools
mise install

# Verify versions are active
mise current
```

**Expected output:**
```
node     22.x.x    ~/.local/share/mise/installs/node/22
pnpm     10.7.0    ~/.local/share/mise/installs/pnpm/10.7.0
```

mise automatically activates these versions whenever you `cd` into the project directory.

---

## Installing the SDK

The x402 SDK is organized as multiple packages. Install only what you need for your use case.

### For Client Applications

**Basic fetch client (most common):**
```bash
pnpm add @x402/fetch @x402/evm viem
```

**Or with npm:**
```bash
npm install @x402/fetch @x402/evm viem
```

**Or with yarn:**
```bash
yarn add @x402/fetch @x402/evm viem
```

**Axios client:**
```bash
pnpm add @x402/axios @x402/evm viem
```

**Required packages for clients:**
- `@x402/fetch` or `@x402/axios` - HTTP client wrapper
- `@x402/evm` or `@x402/svm` - Payment mechanism (EVM for Ethereum-based chains, SVM for Solana)
- `viem` (for EVM) or `@solana/web3.js` (for SVM) - Blockchain interaction library

### For Server Applications

**Express server (most common):**
```bash
pnpm add @x402/express @x402/evm viem express
```

**Hono server:**
```bash
pnpm add @x402/hono @x402/evm viem hono
```

**Next.js (App Router or Pages Router):**
```bash
pnpm add @x402/next @x402/express @x402/evm viem next
```

**Required packages for servers:**
- `@x402/express`, `@x402/hono`, or `@x402/next` - Framework middleware
- `@x402/evm` or `@x402/svm` - Payment mechanism
- `viem` (for EVM) or `@solana/web3.js` (for SVM) - Blockchain interaction library
- Framework package (`express`, `hono`, `next`, etc.)

### Additional Packages

**Extensions (service discovery, authentication):**
```bash
pnpm add @x402/extensions
```

**UI paywall component:**
```bash
pnpm add @x402/paywall
```

---

## Environment Configuration

Create a `.env` file in your project root to store configuration and secrets.

### Client Environment Variables

```bash
# Required: Private key for signing payments
EVM_PRIVATE_KEY=0x1234567890abcdef...  # Your wallet private key (64 hex chars)

# Optional: Target server configuration
RESOURCE_SERVER_URL=http://localhost:4021
ENDPOINT_PATH=/protected
```

### Server Environment Variables

```bash
# Required: Address to receive payments
EVM_ADDRESS=0x742d35Cc6634C0532925a3b844Bc454e4438f44e

# Required: Private key for facilitator operations
EVM_PRIVATE_KEY=0x1234567890abcdef...  # Facilitator wallet private key

# Optional: Server configuration
PORT=4021
NODE_ENV=development

# Optional: Network configuration
NETWORK=eip155:84532  # Base Sepolia testnet
```

### Solana (SVM) Environment Variables

For Solana-based payments:

```bash
# Client
SVM_PRIVATE_KEY=your_base58_encoded_solana_private_key

# Server
SVM_ADDRESS=your_solana_public_key
SVM_PRIVATE_KEY=your_base58_encoded_solana_private_key
NETWORK=solana:devnet
```

**Security Warning:** Never commit `.env` files to version control. Add `.env` to your `.gitignore`:

```bash
echo ".env" >> .gitignore
```

---

## Wallet Setup

You need a wallet with a private key to use x402.

### Creating a Wallet for EVM (Ethereum/Base)

**Using a wallet app (recommended for production):**
1. Install [Coinbase Wallet](https://www.coinbase.com/wallet) or [MetaMask](https://metamask.io/)
2. Create a new wallet
3. Export the private key (keep this secret!)
4. Add the private key to your `.env` file

**Using viem (for development/testing):**

```typescript
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Generate a new private key
const privateKey = generatePrivateKey();
console.log('Private Key:', privateKey);

// Derive the account
const account = privateKeyToAccount(privateKey);
console.log('Address:', account.address);
```

**For testing, you can use a deterministic test key:**
```bash
# DO NOT USE IN PRODUCTION
EVM_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# This corresponds to the first Anvil/Hardhat test account
```

### Creating a Wallet for SVM (Solana)

**Using Phantom wallet (recommended):**
1. Install [Phantom](https://phantom.app/)
2. Create a new wallet
3. Export the private key
4. Add to `.env` file

**Using Solana CLI:**
```bash
solana-keygen new --outfile ~/.config/solana/test-wallet.json
solana-keygen pubkey ~/.config/solana/test-wallet.json
```

---

## Getting Testnet Funds

### For Base Sepolia (EVM)

You need USDC on Base Sepolia testnet for testing.

**Step 1: Get Sepolia ETH**
- Visit [Coinbase Faucet](https://www.coinbase.com/faucets/ethereum-sepolia-faucet)
- Enter your wallet address
- Request Sepolia ETH (for gas fees)

**Step 2: Bridge to Base Sepolia**
- Visit [Base Sepolia Bridge](https://bridge.base.org/)
- Connect your wallet
- Bridge Sepolia ETH to Base Sepolia

**Step 3: Get USDC on Base Sepolia**
- Visit [Circle USDC Faucet](https://faucet.circle.com/)
- Select "Base Sepolia" network
- Enter your wallet address
- Request USDC

**Alternative: Use a faucet contract**
```typescript
// Mint test USDC directly on Base Sepolia
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
// Call the faucet function (implementation specific)
```

### For Solana Devnet (SVM)

**Get SOL (for gas fees):**
```bash
solana airdrop 2 <YOUR_ADDRESS> --url devnet
```

**Get test tokens:**
Visit [Solana Faucet](https://faucet.solana.com/) and request devnet SOL.

---

## Verification

Verify your setup is correct:

### 1. Check Tool Versions

```bash
node --version   # Should be >= 18.0.0
pnpm --version   # Should be 10.7.0 (if using pnpm)
```

### 2. Check Environment Variables

```bash
# Create a test script: verify-env.js
cat > verify-env.js << 'EOF'
import { config } from 'dotenv';
import { privateKeyToAccount } from 'viem/accounts';

config();

console.log('Checking environment...\n');

// Check EVM private key
if (process.env.EVM_PRIVATE_KEY) {
  try {
    const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
    console.log('✅ EVM_PRIVATE_KEY is valid');
    console.log('   Address:', account.address);
  } catch (err) {
    console.log('❌ EVM_PRIVATE_KEY is invalid:', err.message);
  }
} else {
  console.log('⚠️  EVM_PRIVATE_KEY not set');
}

// Check EVM address
if (process.env.EVM_ADDRESS) {
  console.log('✅ EVM_ADDRESS is set:', process.env.EVM_ADDRESS);
} else {
  console.log('⚠️  EVM_ADDRESS not set');
}

console.log('\nSetup looks good! Ready to proceed.');
EOF

# Run verification
node verify-env.js
```

### 3. Test Package Installation

Create a minimal test file:

```typescript
// test-imports.js
import { wrapFetchWithPayment } from '@x402/fetch';
import { ExactEvmClient } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

console.log('✅ All packages imported successfully');
console.log('   @x402/fetch:', typeof wrapFetchWithPayment);
console.log('   @x402/evm:', typeof ExactEvmClient);
console.log('   viem:', typeof privateKeyToAccount);
```

Run it:
```bash
node test-imports.js
```

Expected output:
```
✅ All packages imported successfully
   @x402/fetch: function
   @x402/evm: function
   viem: function
```

---

## Troubleshooting

### "Cannot find module '@x402/fetch'"

**Solution:** Install the package:
```bash
pnpm add @x402/fetch @x402/evm viem
```

### "Invalid private key format"

**Solution:** Ensure your private key:
- Starts with `0x`
- Is exactly 66 characters long (0x + 64 hex characters)
- Contains only valid hex characters (0-9, a-f)

### "mise: command not found"

**Solution:** Install mise following the instructions in [Version Management with mise](#version-management-with-mise)

### "Permission denied" when running scripts

**Solution:** Make scripts executable:
```bash
chmod +x verify-env.js
```

### Package version conflicts

**Solution:** Use exact versions and clear cache:
```bash
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## Next Steps

Now that your environment is configured:

1. **Build a client**: [Client Quick Start](./quick-start-client.md)
2. **Build a server**: [Server Quick Start](./quick-start-server.md)
3. **Explore examples**: [Tutorials](../07-tutorials/README.md)

---

## Additional Resources

- [SDK Reference](../03-sdk-reference/README.md) - Complete API documentation
- [Protocol Overview](../01-overview/what-is-x402.md) - Understanding x402
- [Reference Implementations](../04-reference-implementation/README.md) - Production-ready examples
