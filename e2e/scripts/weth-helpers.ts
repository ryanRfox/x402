/**
 * WETH Wrap/Unwrap Helpers
 *
 * This script provides utilities for wrapping ETH to WETH and unwrapping WETH to ETH
 * on Base Sepolia using the WETH9 contract.
 *
 * Usage:
 *   pnpm tsx scripts/weth-helpers.ts wrap <amount>    # Wrap ETH to WETH (amount in ETH)
 *   pnpm tsx scripts/weth-helpers.ts unwrap <amount>  # Unwrap WETH to ETH (amount in ETH)
 *   pnpm tsx scripts/weth-helpers.ts balance          # Get current WETH balance
 *
 * Environment variables required:
 *   CLIENT_EVM_PRIVATE_KEY - Private key of the client wallet
 */

import { config } from 'dotenv';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  parseEther,
  formatEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

config();

// WETH9 on Base Sepolia
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

// WETH9 ABI for deposit, withdraw, and balanceOf
const weth9Abi = parseAbi([
  'function deposit() payable',
  'function withdraw(uint256 amount)',
  'function balanceOf(address account) view returns (uint256)',
]);

// Initialize clients
function getClients() {
  const privateKey = process.env.CLIENT_EVM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ CLIENT_EVM_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  return { account, publicClient, walletClient };
}

/**
 * Wrap ETH to WETH
 * @param amount Amount in wei to wrap
 * @returns Transaction hash
 */
export async function wrapETH(amount: bigint): Promise<string> {
  const { account, publicClient, walletClient } = getClients();

  console.log(`\n🔑 Wallet: ${account.address}`);
  console.log(`📍 Network: Base Sepolia`);
  console.log(`💰 WETH: ${WETH_ADDRESS}\n`);

  console.log(`🔄 Wrapping ${formatEther(amount)} ETH to WETH...`);

  const hash = await walletClient.writeContract({
    address: WETH_ADDRESS,
    abi: weth9Abi,
    functionName: 'deposit',
    value: amount,
  });

  console.log(`📝 Transaction submitted: ${hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log(`\n✅ Successfully wrapped ${formatEther(amount)} ETH to WETH!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}`);
  } else {
    console.error(`\n❌ Transaction failed`);
    process.exit(1);
  }

  return hash;
}

/**
 * Unwrap WETH to ETH
 * @param amount Amount in wei to unwrap
 * @returns Transaction hash
 */
export async function unwrapWETH(amount: bigint): Promise<string> {
  const { account, publicClient, walletClient } = getClients();

  console.log(`\n🔑 Wallet: ${account.address}`);
  console.log(`📍 Network: Base Sepolia`);
  console.log(`💰 WETH: ${WETH_ADDRESS}\n`);

  console.log(`🔄 Unwrapping ${formatEther(amount)} WETH to ETH...`);

  const hash = await walletClient.writeContract({
    address: WETH_ADDRESS,
    abi: weth9Abi,
    functionName: 'withdraw',
    args: [amount],
  });

  console.log(`📝 Transaction submitted: ${hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log(`\n✅ Successfully unwrapped ${formatEther(amount)} WETH to ETH!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}`);
  } else {
    console.error(`\n❌ Transaction failed`);
    process.exit(1);
  }

  return hash;
}

/**
 * Get current WETH balance
 * @returns Balance in wei
 */
export async function getWETHBalance(): Promise<bigint> {
  const { account, publicClient } = getClients();

  const balance = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: weth9Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });

  return balance;
}

async function main() {
  const action = process.argv[2];
  const amountArg = process.argv[3];

  if (!action || !['wrap', 'unwrap', 'balance'].includes(action)) {
    console.log(`
WETH Wrap/Unwrap Helpers

Usage:
  pnpm tsx scripts/weth-helpers.ts wrap <amount>    # Wrap ETH to WETH (amount in ETH)
  pnpm tsx scripts/weth-helpers.ts unwrap <amount>  # Unwrap WETH to ETH (amount in ETH)
  pnpm tsx scripts/weth-helpers.ts balance          # Get current WETH balance

Environment variables required:
  CLIENT_EVM_PRIVATE_KEY - Private key of the client wallet
`);
    process.exit(1);
  }

  if (action === 'balance') {
    const { account } = getClients();
    console.log(`\n🔑 Wallet: ${account.address}`);
    console.log(`📍 Network: Base Sepolia`);
    console.log(`💰 WETH: ${WETH_ADDRESS}\n`);

    const balance = await getWETHBalance();
    console.log(`💵 WETH Balance: ${formatEther(balance)} WETH`);
    return;
  }

  if (!amountArg) {
    console.error(`❌ Amount is required for ${action} action`);
    console.error(`   Example: pnpm tsx scripts/weth-helpers.ts ${action} 0.001`);
    process.exit(1);
  }

  const amount = parseEther(amountArg);

  if (action === 'wrap') {
    await wrapETH(amount);
  } else if (action === 'unwrap') {
    await unwrapWETH(amount);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
