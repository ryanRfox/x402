<!-- VERIFIED: 3c3e2168 -->
# Environment Setup

Detailed guide for configuring your development environment for x402.

## Environment Variables

### Client Configuration

```bash
# EVM wallet private key (with 0x prefix)
EVM_PRIVATE_KEY=0x...

# Solana wallet private key (base58 encoded)
SVM_PRIVATE_KEY=...
```

### Server Configuration

```bash
# Server port
PORT=4021

# EVM address to receive payments
EVM_PAYEE_ADDRESS=0x...

# Solana address to receive payments
SVM_PAYEE_ADDRESS=...

# Facilitator URL
FACILITATOR_URL=https://facilitator.x402.org
```

### Facilitator Configuration

```bash
# Server port
PORT=4022

# EVM private key for settlement transactions
EVM_PRIVATE_KEY=0x...

# Solana private key for settlement transactions
SVM_PRIVATE_KEY=...
```

## Wallet Setup

### Creating an EVM Wallet

Generate a new wallet using viem:

```typescript
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log("Private Key:", privateKey);
console.log("Address:", account.address);
```

Or use existing tools:

```bash
# Using cast (Foundry)
cast wallet new

# Using openssl
openssl rand -hex 32 | sed 's/^/0x/'
```

### Creating a Solana Wallet

Generate a new keypair using @solana/kit:

```typescript
import { generateKeyPairSigner } from "@solana/kit";
import { base58 } from "@scure/base";

const signer = await generateKeyPairSigner();
const privateKeyBytes = await signer.keyPair.privateKey.export();
const privateKeyBase58 = base58.encode(new Uint8Array(privateKeyBytes));

console.log("Private Key:", privateKeyBase58);
console.log("Address:", signer.address);
```

Or use the Solana CLI:

```bash
solana-keygen new --outfile wallet.json
```

## Network Configuration

### EVM Networks

| Network | Chain ID | RPC URL | Block Explorer |
|---------|----------|---------|----------------|
| Base Mainnet | 8453 | https://mainnet.base.org | https://basescan.org |
| Base Sepolia | 84532 | https://sepolia.base.org | https://sepolia.basescan.org |
| Ethereum Mainnet | 1 | https://eth.llamarpc.com | https://etherscan.io |

### Solana Networks

| Network | Genesis Hash | RPC URL | Explorer |
|---------|--------------|---------|----------|
| Mainnet | `5eykt4Us...` | https://api.mainnet-beta.solana.com | https://solscan.io |
| Devnet | `EtWTRABZ...` | https://api.devnet.solana.com | https://solscan.io?cluster=devnet |

## Testnet Resources

### Getting Testnet USDC

#### Base Sepolia

1. Get testnet ETH from the [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
2. Use a USDC faucet or mint test tokens

#### Solana Devnet

1. Get devnet SOL:
   ```bash
   solana airdrop 2 <your-address> --url devnet
   ```
2. Get devnet USDC from a faucet

### Getting Testnet Gas

#### Base Sepolia ETH

- [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
- [Alchemy Faucet](https://sepoliafaucet.com/)

#### Solana Devnet SOL

```bash
solana airdrop 2 --url devnet
```

## Environment File Example

Create a `.env` file in your project root:

```bash
# ================================
# Client Configuration
# ================================
EVM_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
SVM_PRIVATE_KEY=5MaiiCavjCmn9Hs1o3eznqDEhRwxo7pXiAYez7keQUviUkauRiTMD8DrESdrNjN8zd9mTmVhRvBJeg5vhyvgrAhG

# ================================
# Server Configuration
# ================================
PORT=4021
EVM_PAYEE_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
SVM_PAYEE_ADDRESS=GdBfKgEk5LJ8YMjRgmLAGLWEXQnMgAHxFBGNgXLPBqDX
FACILITATOR_URL=https://facilitator.x402.org

# ================================
# Facilitator Configuration (if self-hosting)
# ================================
# FACILITATOR_EVM_PRIVATE_KEY=0x...
# FACILITATOR_SVM_PRIVATE_KEY=...
```

## Loading Environment Variables

### Node.js

Using dotenv:

```typescript
import { config } from "dotenv";
config();

const privateKey = process.env.EVM_PRIVATE_KEY;
```

### Security Notes

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use different keys per environment** - Development, staging, production
3. **Rotate keys regularly** - Especially for production
4. **Use secret management in production** - AWS Secrets Manager, HashiCorp Vault, etc.

## TypeScript Configuration

Recommended `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

## Package Installation

### Core Packages

```bash
# Client
npm install @x402/fetch viem

# Server (Express)
npm install @x402/express express

# Server (Hono)
npm install @x402/hono hono
```

### Payment Schemes

```bash
# EVM support
npm install @x402/evm viem

# Solana support
npm install @x402/svm @solana/kit @scure/base
```

## Verifying Setup

### Test Client Setup

```typescript
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
console.log("Client wallet:", account.address);

const client = new x402Client();
registerExactEvmScheme(client, { signer: account });
console.log("Client configured successfully");
```

### Test Server Setup

```typescript
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL,
});

const server = new x402ResourceServer(facilitator);
registerExactEvmScheme(server);

await server.initialize();
console.log("Server configured successfully");
```

## Next Steps

- [Running Tests](./running-tests.md) - Execute E2E tests
- [Production](./production.md) - Production deployment guide
