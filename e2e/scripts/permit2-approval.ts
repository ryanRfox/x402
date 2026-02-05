/**
 * Permit2 Approval Script
 *
 * This script ensures the client wallet has approved Permit2 to spend USDC and WETH.
 * It checks current allowances and grants unlimited approval if needed.
 * For WETH, it also wraps a small amount of ETH if the WETH balance is zero.
 *
 * Usage:
 *   pnpm tsx scripts/permit2-approval.ts approve  # Check and approve if needed
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
  formatUnits,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

config();

// Permit2 canonical address (same on all EVM chains)
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

// Base Sepolia USDC
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_DECIMALS = 6;

// Base Sepolia WETH
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
const WETH_DECIMALS = 18;

// Amount of ETH to wrap if WETH balance is zero
const WETH_WRAP_AMOUNT = parseEther('0.001');

// Maximum uint256 for unlimited approval
const MAX_UINT256 = 2n ** 256n - 1n;

// ERC20 ABI for approve and allowance
const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
]);

// WETH ABI for deposit (wrapping ETH)
const wethAbi = parseAbi([
  'function deposit() payable',
]);

async function approveTokenForPermit2(
  tokenAddress: `0x${string}`,
  tokenSymbol: string,
  tokenDecimals: number,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
) {
  console.log(`\n--- ${tokenSymbol} ---`);

  // Check current balance
  const balance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log(`💵 ${tokenSymbol} Balance: ${formatUnits(balance, tokenDecimals)} ${tokenSymbol}`);

  // Check current allowance
  const currentAllowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, PERMIT2_ADDRESS],
  });

  const formattedAllowance =
    currentAllowance === MAX_UINT256
      ? 'unlimited'
      : `${formatUnits(currentAllowance, tokenDecimals)} ${tokenSymbol}`;
  console.log(`📋 Current Permit2 Allowance: ${formattedAllowance}`);

  // Check if approval already exists
  if (currentAllowance === MAX_UINT256) {
    console.log(`✅ Permit2 already has unlimited ${tokenSymbol} approval`);
    return;
  }

  // Grant unlimited approval
  console.log(`🔄 Granting unlimited Permit2 approval for ${tokenSymbol}...`);

  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [PERMIT2_ADDRESS, MAX_UINT256],
  });

  console.log(`📝 Transaction submitted: ${hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log(`✅ Permit2 ${tokenSymbol} approval granted successfully!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}`);
  } else {
    console.error(`\n❌ ${tokenSymbol} approval transaction failed`);
    process.exit(1);
  }
}

async function ensureWethBalance(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
) {
  const wethBalance = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });

  // Any non-zero balance is sufficient; we wrap 0.001 WETH on first run,
  // which is ~1000x the per-request cost (0.000001 WETH).
  if (wethBalance > 0n) {
    console.log(`\n💰 WETH Balance: ${formatUnits(wethBalance, WETH_DECIMALS)} WETH (sufficient)`);
    return;
  }

  console.log(`\n💰 WETH Balance: 0 WETH`);
  console.log(`🔄 Wrapping ${formatUnits(WETH_WRAP_AMOUNT, WETH_DECIMALS)} ETH → WETH...`);

  const hash = await walletClient.writeContract({
    address: WETH_ADDRESS,
    abi: wethAbi,
    functionName: 'deposit',
    value: WETH_WRAP_AMOUNT,
  });

  console.log(`📝 Transaction submitted: ${hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log(`✅ Wrapped ${formatUnits(WETH_WRAP_AMOUNT, WETH_DECIMALS)} ETH → WETH`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}`);
  } else {
    console.error(`\n❌ WETH wrap transaction failed`);
    process.exit(1);
  }
}

async function main() {
  const action = process.argv[2];

  if (!action || action !== 'approve') {
    console.log(`
Permit2 Approval Script

Usage:
  pnpm tsx scripts/permit2-approval.ts approve  # Check and approve Permit2 if needed

Environment variables required:
  CLIENT_EVM_PRIVATE_KEY - Private key of the client wallet
`);
    process.exit(1);
  }

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

  console.log(`\n🔑 Wallet: ${account.address}`);
  console.log(`📍 Network: Base Sepolia`);
  console.log(`🔐 Permit2: ${PERMIT2_ADDRESS}`);

  // Ensure WETH balance (wrap ETH if needed)
  await ensureWethBalance(publicClient, walletClient, account);

  // Approve Permit2 for USDC
  await approveTokenForPermit2(
    USDC_ADDRESS, 'USDC', USDC_DECIMALS,
    publicClient, walletClient, account,
  );

  // Approve Permit2 for WETH
  await approveTokenForPermit2(
    WETH_ADDRESS, 'WETH', WETH_DECIMALS,
    publicClient, walletClient, account,
  );

  console.log('\n✅ All Permit2 approvals complete!');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
