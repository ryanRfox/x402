/**
 * Gas Analysis Utility for E2E Test Transactions
 *
 * Queries Base Sepolia RPC to retrieve transaction receipts and analyze gas usage
 * for different payment methods (EIP-3009 USDC vs Permit2 settlement).
 *
 * Usage:
 *   npx tsx analyze-gas.ts <tx_hash> [tx_hash2] [tx_hash3] ...
 *
 * Example:
 *   npx tsx analyze-gas.ts 0x7ae39bf4... 0xfd1a5f57...
 */

import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

interface TransactionAnalysis {
  hash: string;
  blockNumber: number;
  gasUsed: bigint;
  gasPrice: bigint;
  gasCostEth: string;
  gasCostUSD: string;
  type: string;
  status: 'success' | 'failed';
}

// Create RPC client for Base Sepolia
const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

/**
 * Analyze a single transaction
 */
async function analyzeTransaction(txHash: string): Promise<TransactionAnalysis> {
  try {
    // Fetch transaction and receipt in parallel
    const [tx, receipt] = await Promise.all([
      client.getTransaction({ hash: txHash as `0x${string}` }),
      client.getTransactionReceipt({ hash: txHash as `0x${string}` }),
    ]);

    if (!receipt) {
      throw new Error(`Receipt not found for ${txHash}`);
    }

    const gasUsed = receipt.gasUsed;
    const gasPrice = tx.gasPrice || 0n;
    const gasCostWei = gasUsed * gasPrice;
    const gasCostEth = Number(gasCostWei) / 1e18;

    // Estimate USD cost (Base Sepolia ETH is not worth real money, but for reference)
    // Using ~2500 USD/ETH as a rough estimate for calculation purposes
    const gasCostUSD = (gasCostEth * 2500).toFixed(6);

    // Determine transaction type from function selector or other patterns
    const inputData = tx.input;
    let type = 'Unknown';
    if (inputData === '0x') {
      type = 'Transfer';
    } else if (inputData.startsWith('0xa9059cbb')) {
      type = 'ERC20 Transfer';
    } else if (inputData.startsWith('0x414bf389')) {
      type = 'Permit2 Transfer'; // permitTransferFrom selector
    } else if (inputData.startsWith('0x3644e515')) {
      type = 'Permit2 Witness'; // permitWitnessTransferFrom selector
    } else if (inputData.startsWith('0x36d7b5d0')) {
      type = 'Settlement Execute'; // X402Settlement.executePayment
    }

    return {
      hash: txHash,
      blockNumber: receipt.blockNumber,
      gasUsed,
      gasPrice,
      gasCostEth: gasCostEth.toFixed(10),
      gasCostUSD,
      type,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  } catch (error) {
    throw new Error(`Failed to analyze ${txHash}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx analyze-gas.ts <tx_hash> [tx_hash2] ...');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx analyze-gas.ts 0x7ae39bf4... 0xfd1a5f57...');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('Base Sepolia Gas Analysis');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const results: TransactionAnalysis[] = [];

  // Analyze all provided transaction hashes
  for (const hash of args) {
    try {
      console.log(`📊 Analyzing: ${hash}...`);
      const analysis = await analyzeTransaction(hash);
      results.push(analysis);
      console.log(`   ✅ Gas Used: ${analysis.gasUsed.toString()} units`);
      console.log(`   💰 Cost: ${analysis.gasCostEth} ETH (≈$${analysis.gasCostUSD})`);
      console.log(`   Type: ${analysis.type}`);
      console.log('');
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      console.log('');
    }
  }

  if (results.length === 0) {
    console.error('No transactions analyzed successfully.');
    process.exit(1);
  }

  // Display summary
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('Summary');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const successResults = results.filter((r) => r.status === 'success');
  if (successResults.length > 0) {
    console.log('Transaction Details:\n');
    console.table(
      successResults.map((r) => ({
        'Hash': r.hash.substring(0, 16) + '...',
        'Gas Used': r.gasUsed.toString(),
        'Gas Price (gwei)': (Number(r.gasPrice) / 1e9).toFixed(2),
        'Cost (ETH)': r.gasCostEth,
        'Type': r.type,
      })),
    );
    console.log('');

    // Calculate averages and comparisons
    if (successResults.length > 1) {
      const avgGasUsed =
        successResults.reduce((sum, r) => sum + Number(r.gasUsed), 0) / successResults.length;
      const minGas = Math.min(...successResults.map((r) => Number(r.gasUsed)));
      const maxGas = Math.max(...successResults.map((r) => Number(r.gasUsed)));

      console.log('Gas Usage Statistics:\n');
      console.log(`  Average Gas: ${Math.round(avgGasUsed).toLocaleString()} units`);
      console.log(`  Min Gas: ${minGas.toLocaleString()} units`);
      console.log(`  Max Gas: ${maxGas.toLocaleString()} units`);
      console.log(`  Range: ${(maxGas - minGas).toLocaleString()} units`);

      // If we have EIP-3009 and Permit2 transactions, calculate overhead
      const eip3009 = successResults.find((r) => r.type.includes('EIP') || r.type.includes('3009'));
      const permit2 = successResults.find(
        (r) => r.type.includes('Permit2') || r.type.includes('Settlement'),
      );

      if (eip3009 && permit2) {
        const overhead = Number(permit2.gasUsed) - Number(eip3009.gasUsed);
        const overheadPercent = ((overhead / Number(eip3009.gasUsed)) * 100).toFixed(1);
        console.log(`\n  Settlement Overhead: ${overhead.toLocaleString()} gas (+${overheadPercent}%)`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
